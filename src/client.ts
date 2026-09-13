import { z } from 'zod';
import { ServiceRegistry, PoolConfig } from './registry';
import { RouterDefinition, ProcedureDefinition, ServiceClient, InferInput, InferOutput } from './types';
import { ValidationError } from './errors';

export function createClient<T extends Record<string, { queue: string; router: RouterDefinition }>>(
  config: PoolConfig
): { client: ServiceClient<{ [K in keyof T]: T[K]['router'] }>; registry: ServiceRegistry } {
  const registry = new ServiceRegistry(config);

  const client = new Proxy({} as ServiceClient<{ [K in keyof T]: T[K]['router'] }>, {
    get(_, serviceName: string) {
      return new Proxy({} as any, {
        get(_, procedureName: string) {
          return async (input: any) => {
            const serviceDef = registry.getService(serviceName);
            if (!serviceDef) {
              throw new Error(`Service '${serviceName}' not registered`);
            }

            const procedureDef = serviceDef.procedures[procedureName] as ProcedureDefinition;
            if (!procedureDef) {
              throw new Error(`Procedure '${procedureName}' not found in service '${serviceName}'`);
            }

            const inputResult = procedureDef._input.safeParse(input);
            if (!inputResult.success) {
              throw new ValidationError(serviceName, procedureName, 'input', inputResult.error);
            }

            const response = await registry.call(serviceName, procedureName, inputResult.data);

            const outputResult = procedureDef._output.safeParse(response);
            if (!outputResult.success) {
              throw new ValidationError(serviceName, procedureName, 'output', outputResult.error);
            }

            return outputResult.data;
          };
        }
      });
    }
  });

  return { client, registry };
}
