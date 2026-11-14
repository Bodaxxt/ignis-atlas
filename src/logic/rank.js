/**
 * Ignis Atlas - Experiment Ranking Module
 * Pure JS module for ranking experiments by coverage distance against a scenario.
 */

import { calculateCoverage } from './coverage.js';

const STATUS_PRIORITY = {
  covered: 0,
  near: 1,
  gap: 2,
  insufficient: 3,
};

/**
 * Evaluates and ranks all experiments against a scenario.
 * 
 * @param {Object} scenario - Mission scenario parameters
 * @param {Array<Object>} experiments - Array of experiments per data contract
 * @returns {Array<{ experiment: Object, coverage: { status: string, distance: number|null, reasons: string[] } }>}
 */
export function rankExperiments(scenario, experiments) {
  if (!Array.isArray(experiments)) {
    return [];
  }

  const scored = experiments.map((experiment) => {
    const coverage = calculateCoverage(scenario, experiment);
    return {
      experiment,
      coverage,
    };
  });

  scored.sort((a, b) => {
    const priorityA = STATUS_PRIORITY[a.coverage.status] ?? 99;
    const priorityB = STATUS_PRIORITY[b.coverage.status] ?? 99;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // Secondary sort: ascending by distance
    const distA = a.coverage.distance !== null ? a.coverage.distance : Infinity;
    const distB = b.coverage.distance !== null ? b.coverage.distance : Infinity;

    if (distA !== distB) {
      return distA - distB;
    }

    // Tertiary sort: by experiment id (natural numeric sort e.g. PSI-25 before PSI-140)
    return (a.experiment.id || '').localeCompare(b.experiment.id || '', undefined, { numeric: true });
  });

  return scored;
}

