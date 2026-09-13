import { z } from 'zod';

export class ValidationError extends Error {
  constructor(
    public readonly service: string,
    public readonly procedure: string,
    public readonly type: 'input' | 'output',
    public readonly errors: z.ZodError
  ) {
    super(`Validation error in ${service}.${procedure} (${type}): ${errors.message}`);
    this.name = 'ValidationError';
  }
}
