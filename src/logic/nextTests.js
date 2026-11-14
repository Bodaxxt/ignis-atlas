/**
 * Ignis Atlas - Next Tests Recommendation Engine
 * Discovers critical unmapped cells in the lunar habitat envelope (O2: 30–50%, Pressure: 4.3–10.2 psi).
 * 
 * Strict Scientific & Data Grounding:
 * - Operates strictly on logged rows in experiments.json.
 * - Filters for experiments with complete O2 + pressure ranges.
 * - Evaluates distance to nearest tested envelope across the parameter grid.
 * - Discloses that results depend exclusively on logged rows in the repository.
 */

import { SPANS, WEIGHTS } from './coverage.js';

/**
 * Calculates distance from a grid coordinate (O2, Pressure) to a single experiment.
 * 
 * @param {number} o2 - Oxygen percentage
 * @param {number} pressure - Chamber pressure in psi
 * @param {Object} exp - Experiment object
 * @returns {number} Normalized distance
 */
function calculatePointDistance(o2, pressure, exp) {
  const [minO2, maxO2] = exp.o2;
  const [minP, maxP] = exp.pressure_psi;

  const o2Gap = (o2 >= minO2 && o2 <= maxO2)
    ? 0
    : (o2 < minO2 ? minO2 - o2 : o2 - maxO2) / SPANS.o2;

  const pGap = (pressure >= minP && pressure <= maxP)
    ? 0
    : (pressure < minP ? minP - pressure : pressure - maxP) / SPANS.pressure;

  const totalWeight = WEIGHTS.o2 + WEIGHTS.pressure;
  return (o2Gap * WEIGHTS.o2 + pGap * WEIGHTS.pressure) / totalWeight;
}

/**
 * Computes the 3 farthest unmapped cells across the lunar exploration parameter grid.
 * 
 * @param {Array<Object>} experiments - Loaded experiments dataset
 * @returns {{ disclaimer: string, farthestCells: Array<{ o2: number, pressure_psi: number, minDistance: number, nearestExperimentId: string, reason: string }> }}
 */
export function findNextTests(experiments) {
  const disclaimer = 'Results depend on logged rows in experiments.json only.';

  if (!Array.isArray(experiments) || experiments.length === 0) {
    return {
      disclaimer,
      farthestCells: [],
    };
  }

  // Filter for experiments with complete numeric O2 and Pressure ranges
  const completeExperiments = experiments.filter(
    (exp) =>
      exp &&
      Array.isArray(exp.o2) &&
      exp.o2.length === 2 &&
      typeof exp.o2[0] === 'number' &&
      typeof exp.o2[1] === 'number' &&
      Array.isArray(exp.pressure_psi) &&
      exp.pressure_psi.length === 2 &&
      typeof exp.pressure_psi[0] === 'number' &&
      typeof exp.pressure_psi[1] === 'number'
  );

  if (completeExperiments.length === 0) {
    return {
      disclaimer,
      farthestCells: [],
    };
  }

  // 1. Generate O2 grid: 30 to 50 step 2
  const o2Grid = [];
  for (let o2 = 30; o2 <= 50; o2 += 2) {
    o2Grid.push(o2);
  }

  // 2. Generate Pressure grid: 4.3 to 10.2 step 0.5
  const pressureGrid = [];
  for (let p = 4.3; p <= 10.2001; p += 0.5) {
    pressureGrid.push(Number(p.toFixed(2)));
  }
  // Ensure exact upper boundary (10.2 psi) is included
  if (!pressureGrid.includes(10.2)) {
    pressureGrid.push(10.2);
  }

  const evaluatedCells = [];

  // Evaluate each grid cell
  for (const o2 of o2Grid) {
    for (const pressure of pressureGrid) {
      let minDistance = Infinity;
      let nearestExp = null;

      for (const exp of completeExperiments) {
        const dist = calculatePointDistance(o2, pressure, exp);
        if (dist < minDistance) {
          minDistance = dist;
          nearestExp = exp;
        }
      }

      const formattedDist = Number(minDistance.toFixed(4));
      const reason = `O2 ${o2.toFixed(1)}%, ${pressure.toFixed(1)} psi is ${formattedDist} normalized distance from nearest dataset (${nearestExp ? nearestExp.name : 'none'}) due to unmapped exploration bounds.`;

      evaluatedCells.push({
        o2,
        pressure_psi: pressure,
        minDistance: formattedDist,
        nearestExperimentId: nearestExp ? nearestExp.id : 'N/A',
        reason,
      });
    }
  }

  // Sort descending by minDistance to identify greatest parameter gaps
  evaluatedCells.sort((a, b) => b.minDistance - a.minDistance);

  // Return the top 3 farthest cells
  const farthestCells = evaluatedCells.slice(0, 3);

  return {
    disclaimer,
    farthestCells,
  };
}

