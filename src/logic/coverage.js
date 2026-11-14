/**
 * Ignis Atlas - Coverage Engine
 * Pure JS module for calculating experimental coverage against exploration scenarios.
 * 
 * Strict Scientific & Engineering Rules:
 * - Weights: O2: 0.35, Pressure: 0.25, Airflow: 0.15, Material: 0.15, Gravity: 0.10.
 * - Spans: O2: 100, Pressure: 75, Airflow: 50.
 * - Missing/null numeric variables are skipped and weights renormalized.
 * - "insufficient" status if fewer than 2 numeric variables could be compared.
 * - Status: "covered" if D <= 0.10 and materialGap == 0; "near" if D <= 0.35; else "gap".
 * - Cap rule: if scenario gravity is lunar or mars, status can never be better than "near"
 *   (no partial-gravity combustion data exists in PSI).
 * - Reasons are plain-English strings explaining every factor.
 */

export const WEIGHTS = {
  o2: 0.35,
  pressure: 0.25,
  airflow: 0.15,
  material: 0.15,
  gravity: 0.10,
};

export const SPANS = {
  o2: 100,
  pressure: 75,
  airflow: 50,
};

/**
 * Calculates experimental coverage for a given scenario against a single experiment.
 * 
 * @param {Object} scenario
 * @param {number|null} scenario.o2 - Oxygen percentage (e.g. 34.0)
 * @param {number|null} scenario.pressure_psi - Pressure in psi (e.g. 8.2)
 * @param {number|null} [scenario.airflow_cms] - Forced airflow in cm/s (e.g. 4.0)
 * @param {"0g"|"lunar"|"mars"|"1g"} scenario.gravity - Gravitational environment
 * @param {"sibal"|"pmma"|"nomex"|"other"|string} scenario.material - Material identifier
 * 
 * @param {Object} experiment - Experiment record per data contract
 * @returns {{ status: "covered"|"near"|"gap"|"insufficient", distance: number|null, reasons: string[] }}
 */
export function calculateCoverage(scenario, experiment) {
  const reasons = [];
  let weightedSum = 0;
  let totalUsedWeight = 0;
  let numericComparedCount = 0;

  // 1. Oxygen (O2 %) comparison
  if (
    scenario &&
    scenario.o2 !== null &&
    scenario.o2 !== undefined &&
    experiment &&
    Array.isArray(experiment.o2) &&
    experiment.o2.length === 2 &&
    typeof experiment.o2[0] === 'number' &&
    typeof experiment.o2[1] === 'number'
  ) {
    numericComparedCount++;
    const [minO2, maxO2] = experiment.o2;
    let o2Gap = 0;

    if (scenario.o2 >= minO2 && scenario.o2 <= maxO2) {
      o2Gap = 0;
      reasons.push(`O2 ${scenario.o2}% is inside tested range ${minO2}–${maxO2}%`);
    } else {
      const dist = scenario.o2 < minO2 ? minO2 - scenario.o2 : scenario.o2 - maxO2;
      o2Gap = dist / SPANS.o2;
      reasons.push(`O2 ${scenario.o2}% is outside tested range ${minO2}–${maxO2}% (gap: ${o2Gap.toFixed(4)})`);
    }

    weightedSum += o2Gap * WEIGHTS.o2;
    totalUsedWeight += WEIGHTS.o2;
  } else {
    reasons.push('O2 variable skipped (missing in scenario or experiment)');
  }

  // 2. Pressure (psi) comparison
  if (
    scenario &&
    scenario.pressure_psi !== null &&
    scenario.pressure_psi !== undefined &&
    experiment &&
    Array.isArray(experiment.pressure_psi) &&
    experiment.pressure_psi.length === 2 &&
    typeof experiment.pressure_psi[0] === 'number' &&
    typeof experiment.pressure_psi[1] === 'number'
  ) {
    numericComparedCount++;
    const [minP, maxP] = experiment.pressure_psi;
    let pGap = 0;

    if (scenario.pressure_psi >= minP && scenario.pressure_psi <= maxP) {
      pGap = 0;
      reasons.push(`Pressure ${scenario.pressure_psi} psi is inside tested range ${minP}–${maxP} psi`);
    } else {
      const dist = scenario.pressure_psi < minP ? minP - scenario.pressure_psi : scenario.pressure_psi - maxP;
      pGap = dist / SPANS.pressure;
      reasons.push(`Pressure ${scenario.pressure_psi} psi is outside tested range ${minP}–${maxP} psi (gap: ${pGap.toFixed(4)})`);
    }

    weightedSum += pGap * WEIGHTS.pressure;
    totalUsedWeight += WEIGHTS.pressure;
  } else {
    reasons.push('Pressure variable skipped (missing in scenario or experiment)');
  }

  // 3. Airflow (cm/s) comparison
  if (
    scenario &&
    scenario.airflow_cms !== null &&
    scenario.airflow_cms !== undefined &&
    experiment &&
    Array.isArray(experiment.airflow_cms) &&
    experiment.airflow_cms.length === 2 &&
    typeof experiment.airflow_cms[0] === 'number' &&
    typeof experiment.airflow_cms[1] === 'number'
  ) {
    numericComparedCount++;
    const [minFlow, maxFlow] = experiment.airflow_cms;
    let flowGap = 0;

    if (scenario.airflow_cms >= minFlow && scenario.airflow_cms <= maxFlow) {
      flowGap = 0;
      reasons.push(`Airflow ${scenario.airflow_cms} cm/s is inside tested range ${minFlow}–${maxFlow} cm/s`);
    } else {
      const dist = scenario.airflow_cms < minFlow ? minFlow - scenario.airflow_cms : scenario.airflow_cms - maxFlow;
      flowGap = dist / SPANS.airflow;
      reasons.push(`Airflow ${scenario.airflow_cms} cm/s is outside tested range ${minFlow}–${maxFlow} cm/s (gap: ${flowGap.toFixed(4)})`);
    }

    weightedSum += flowGap * WEIGHTS.airflow;
    totalUsedWeight += WEIGHTS.airflow;
  } else {
    reasons.push('Airflow variable skipped (missing in scenario or experiment)');
  }

  // 4. Material comparison
  // Contract rule: 0 if listed, 0.5 if experiment is solid-fuel with unrecorded materials, else 1
  let materialGap = 1.0;
  const sMat = (scenario?.material || '').trim().toLowerCase();
  const expMaterials = Array.isArray(experiment?.materials) ? experiment.materials : [];
  const isSolidFuel = (experiment?.fuel_state || '').toLowerCase().includes('solid');

  const matchesListedMaterial = expMaterials.some((m) => {
    const norm = m.toLowerCase();
    return norm.includes(sMat) || sMat.includes(norm);
  });

  if (sMat && sMat !== 'other' && matchesListedMaterial) {
    materialGap = 0.0;
    reasons.push(`Material '${scenario.material}' is directly listed in experiment materials`);
  } else if (isSolidFuel && expMaterials.length === 0) {
    materialGap = 0.5;
    reasons.push(`Experiment tests solid fuel with unrecorded specific materials (material gap: 0.5)`);
  } else {
    materialGap = 1.0;
    const listedStr = expMaterials.length > 0 ? expMaterials.join(', ') : 'none listed';
    reasons.push(`Material '${scenario?.material}' not covered (experiment tested: ${listedStr})`);
  }

  weightedSum += materialGap * WEIGHTS.material;
  totalUsedWeight += WEIGHTS.material;

  // 5. Gravity comparison
  // Contract rule: 0 if both 0g, else 1
  const isScenarioZeroG = scenario?.gravity === '0g';
  const expGravityStr = (experiment?.gravity || '').toLowerCase();
  const isExpZeroG = expGravityStr.includes('0g') || expGravityStr.includes('micro') || expGravityStr.includes('zero');

  let gravityGap = 1.0;
  if (isScenarioZeroG && isExpZeroG) {
    gravityGap = 0.0;
    reasons.push('Gravity matches microgravity (0g)');
  } else {
    gravityGap = 1.0;
    reasons.push(`Gravity mismatch: scenario '${scenario?.gravity}' vs experiment '${experiment?.gravity || 'unspecified'}'`);
  }

  weightedSum += gravityGap * WEIGHTS.gravity;
  totalUsedWeight += WEIGHTS.gravity;

  // Check numeric comparison requirement
  // "insufficient" if fewer than 2 numeric variables could be compared
  if (numericComparedCount < 2) {
    reasons.unshift(`Insufficient numeric comparison: only ${numericComparedCount} numeric variable(s) could be evaluated (minimum 2 required: O2, pressure, airflow).`);
    return {
      status: 'insufficient',
      distance: null,
      reasons,
    };
  }

  // Renormalize distance over used weights
  const distance = weightedSum / totalUsedWeight;
  const formattedDistance = Number(distance.toFixed(4));

  // Determine base status
  let status = 'gap';
  if (distance <= 0.10 && materialGap === 0) {
    status = 'covered';
  } else if (distance <= 0.35) {
    status = 'near';
  } else {
    status = 'gap';
  }

  // Cap rule: if scenario gravity is lunar or mars, status can never be better than "near"
  // (no partial-gravity data exists in PSI)
  const isPartialG = scenario?.gravity === 'lunar' || scenario?.gravity === 'mars';
  if (isPartialG && status === 'covered') {
    status = 'near';
    reasons.push("Status capped at 'near' because no standardized partial-gravity (lunar/mars) combustion data exists in PSI.");
  }

  return {
    status,
    distance: formattedDistance,
    reasons,
  };
}

