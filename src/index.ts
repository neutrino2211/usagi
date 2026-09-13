// New API exports
export { initUsagi } from './core';
export { createClient } from './client';
export { ServiceRegistry } from './registry';
export { ValidationError } from './errors';
export type {
  ProcedureDefinition,
  RouterDefinition,
  InferInput,
  InferOutput,
  ServiceClient
} from './types';
export type { ServiceDefinition, PoolConfig } from './registry';

// Legacy API exports (deprecated)
export { Broker } from './broker';
export { Instance } from './instance';
