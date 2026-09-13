import { z } from 'zod';

export interface ProcedureDefinition<TInput extends z.ZodTypeAny = z.ZodTypeAny, TOutput extends z.ZodTypeAny = z.ZodTypeAny> {
  _input: TInput;
  _output: TOutput;
  handler: (args: { input: z.infer<TInput> }) => Promise<z.infer<TOutput>>;
}

export interface RouterDefinition {
  [key: string]: ProcedureDefinition | RouterDefinition;
}

export type InferInput<T> = T extends ProcedureDefinition<infer I extends z.ZodTypeAny>
  ? z.infer<I>
  : never;

export type InferOutput<T> = T extends ProcedureDefinition<any, infer O extends z.ZodTypeAny>
  ? z.infer<O>
  : never;

export type ServiceClient<T> = {
  [K in keyof T]: T[K] extends ProcedureDefinition
    ? (input: InferInput<T[K]>) => Promise<InferOutput<T[K]>>
    : T[K] extends RouterDefinition
      ? ServiceClient<T[K]>
      : never;
};
