/**
 * Background AI Services
 *
 * Export all services for use in runtime.ts
 */

export { contextCollector } from './contextCollector';
export type { FragmentFeature, ContextCache } from './contextCollector';

export { insightPrecomputer } from './insightPrecomputer';
export type {
  PrecomputedInsights,
  EnrichedFragment,
  PotentialQuestion
} from './insightPrecomputer';

export { serviceManager } from './serviceManager';
export type { ServiceStatus } from './serviceManager';
