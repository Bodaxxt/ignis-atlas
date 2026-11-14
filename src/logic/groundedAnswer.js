/**
 * Ignis Atlas - Grounded Answer Architecture & Engine Design
 * 
 * DESIGN PRINCIPLES:
 * 1. Strict Grounding: Answers are derived ONLY from verified rows in experiments.json.
 * 2. Source Attribution: Every claim carries an array of source_ids corresponding to experiment IDs,
 *    enabling the UI to render inline source chips with hover previews of raw data rows.
 * 3. Numerical Integrity Post-Check: Any numerical token in the synthesized answer must exist
 *    in the source experiment rows sent. If an unverified number appears, the answer is refused
 *    and replaced with "No data in the table for this question" alongside related experiments
 *    to prevent hallucinated coordinates or boundaries.
 * 4. Zero Fabricated Confidence: Prohibits artificial confidence percentages (e.g., "98% confident").
 * 5. Transparent Reasoning Steps: Returns an array of explicit retrieval and screening steps.
 */

/**
 * Extracts all numeric values (integers, decimals) from a string.
 * @param {string} text
 * @returns {number[]}
 */
export function extractNumbers(text) {
  if (!text) return [];
  // Match standard numbers, including floats (exclude leading/trailing punctuation)
  const matches = text.match(/\b\d+(\.\d+)?\b/g);
  if (!matches) return [];
  return matches.map((m) => parseFloat(m));
}

/**
 * Collects all verified numbers present in an array of experiment rows.
 * @param {Array<Object>} experiments
 * @returns {Set<number>}
 */
export function extractExperimentNumbers(experiments) {
  const numbers = new Set();

  experiments.forEach((exp) => {
    // Add ranges
    if (Array.isArray(exp.o2)) exp.o2.forEach((n) => typeof n === 'number' && numbers.add(n));
    if (Array.isArray(exp.pressure_psi)) exp.pressure_psi.forEach((n) => typeof n === 'number' && numbers.add(n));
    if (Array.isArray(exp.airflow_cms)) exp.airflow_cms.forEach((n) => typeof n === 'number' && numbers.add(n));

    // Add numbers from text fields (key_finding, notes, gravity, id)
    const combinedText = `${exp.key_finding || ''} ${exp.notes || ''} ${exp.gravity || ''} ${exp.hardware || ''} ${exp.id || ''}`;
    const textNumbers = extractNumbers(combinedText);
    textNumbers.forEach((n) => numbers.add(n));
  });

  return numbers;
}

/**
 * Validates that all numbers in the claims exist in the source experiments.
 * @param {Array<{ text: string, source_ids: string[] }>} claims
 * @param {Array<Object>} sourceExperiments
 * @returns {{ valid: boolean, ungroundedNumbers: number[] }}
 */
export function validateClaimNumbers(claims, sourceExperiments) {
  const allowedNumbers = extractExperimentNumbers(sourceExperiments);
  const ungroundedNumbers = [];

  claims.forEach((claim) => {
    const claimNumbers = extractNumbers(claim.text);
    claimNumbers.forEach((num) => {
      // Check if num exists in allowedNumbers (with tiny tolerance for float precision)
      let found = false;
      for (const allowed of allowedNumbers) {
        if (Math.abs(allowed - num) < 0.001) {
          found = true;
          break;
        }
      }
      if (!found) {
        ungroundedNumbers.push(num);
      }
    });
  });

  return {
    valid: ungroundedNumbers.length === 0,
    ungroundedNumbers,
  };
}

/**
 * Finds the nearest related experiments based on keyword/topic match
 * to ensure questions without exact data do not hit a dead end.
 * @param {string} question
 * @param {Array<Object>} experiments
 * @returns {Array<{ id: string, name: string, hardware: string }>}
 */
export function findRelatedExperiments(question, experiments) {
  const tokens = (question || '').toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  
  const scored = experiments.map((exp) => {
    let score = 0;
    const expText = `${exp.name} ${exp.hardware} ${(exp.materials || []).join(' ')} ${exp.fuel_state}`.toLowerCase();
    tokens.forEach((t) => {
      if (expText.includes(t)) score += 1;
    });
    return { exp, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 2).map((s) => ({
    id: s.exp.id,
    name: s.exp.name,
    hardware: s.exp.hardware,
  }));
}

/**
 * Grounded Question-Answering Function
 * 
 * @param {string} question - Natural language or parameter query
 * @param {Array<Object>} experiments - Ground truth experiment rows from experiments.json
 * @returns {{ steps: string[], claims: Array<{ text: string, source_ids: string[] }>, refused: boolean, related_experiments?: Array<Object> }}
 */
export function answer(question, experiments) {
  const steps = [];
  steps.push(`Received question: "${question}"`);

  if (!Array.isArray(experiments) || experiments.length === 0) {
    steps.push('No experiments loaded in database.');
    return {
      steps,
      claims: [{ text: 'No data in the table for this question', source_ids: [] }],
      refused: true,
      related_experiments: [],
    };
  }

  steps.push(`Searching across ${experiments.length} verified NASA PSI experiment rows.`);
  const qLower = (question || '').toLowerCase();

  // Keyword / Parameter filtering
  const matchingExperiments = experiments.filter((exp) => {
    const textCorpus = [
      exp.name,
      exp.hardware,
      exp.fuel_state,
      (exp.materials || []).join(' '),
      exp.key_finding,
      exp.id,
    ]
      .join(' ')
      .toLowerCase();

    // Check for tokens
    const tokens = qLower.split(/\W+/).filter((t) => t.length > 3);
    return tokens.some((token) => textCorpus.includes(token));
  });

  steps.push(`Retrieved ${matchingExperiments.length} relevant candidate experiment row(s).`);

  if (matchingExperiments.length === 0) {
    steps.push('No relevant rows found in database for query terms.');
    const related = findRelatedExperiments(question, experiments);
    return {
      steps,
      claims: [{ text: 'No data in the table for this question', source_ids: [] }],
      refused: true,
      related_experiments: related,
    };
  }

  // Synthesize draft claims strictly using verbatim facts from retrieved rows
  const draftClaims = [];
  matchingExperiments.forEach((exp) => {
    let claimText = '';
    if (exp.o2 && exp.pressure_psi) {
      claimText = `${exp.name} (${exp.id}) in ${exp.hardware} evaluated ${exp.fuel_state.toLowerCase()} combustion between ${exp.o2[0]}% and ${exp.o2[1]}% O2 at ${exp.pressure_psi[0]} to ${exp.pressure_psi[1]} psi.`;
    } else {
      claimText = `${exp.name} (${exp.id}) evaluated ${exp.fuel_state.toLowerCase()} fuels under ${exp.gravity}, with standardized atmospheric ranges flagged as pending verification.`;
    }
    draftClaims.push({
      text: claimText,
      source_ids: [exp.id],
    });
  });

  steps.push(`Drafted ${draftClaims.length} grounded claim(s). Executing numerical integrity verification.`);

  // Post-check: ensure all numbers in draft claims exist in matching experiments
  const validation = validateClaimNumbers(draftClaims, matchingExperiments);

  if (!validation.valid) {
    steps.push(`Numerical integrity violation: ungrounded number(s) detected [${validation.ungroundedNumbers.join(', ')}]. Refusing answer.`);
    const related = findRelatedExperiments(question, experiments);
    return {
      steps,
      claims: [{ text: 'No data in the table for this question', source_ids: [] }],
      refused: true,
      related_experiments: related,
    };
  }

  steps.push('Numerical verification passed: all numbers verified in source records.');

  return {
    steps,
    claims: draftClaims,
    refused: false,
    related_experiments: matchingExperiments.map((e) => ({ id: e.id, name: e.name })),
  };
}

