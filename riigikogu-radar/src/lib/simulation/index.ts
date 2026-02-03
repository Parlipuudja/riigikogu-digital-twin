/**
 * Simulation module exports
 */

export {
  createJob,
  getJob,
  updateProgress,
  completeJob,
  failJob,
  incrementContinuation,
  startProcessing,
  ensureIndexes,
} from "./job-manager";

export {
  processBatch,
  shouldContinue,
  selfInvokeContinuation,
  calculateResult,
  startProcessingJob,
  continueProcessingJob,
} from "./processor";

export {
  findExistingSimulation,
  findSimulationByDraft,
  saveSimulation,
  linkSimulationToDraft,
  getRecentSimulations,
  generateBillHash,
  ensureSimulationIndexes,
} from "./history";
