import { z } from 'zod';
import { ProcedureDefinition, RouterDefinition } from './types';

class ProcedureBuilder<TInput extends z.ZodTypeAny = z.ZodAny, TOutput extends z.ZodTypeAny = z.ZodAny> {
  _input?: TInput;
  _output?: TOutput;
  _handler?: (args: { input: z.infer<TInput> }) => Promise<z.infer<TOutput>>;

  input<T extends z.ZodTypeAny>(schema: T): ProcedureBuilder<T, TOutput> {
    this._input = schema as any;
    return this as any;
  }

  output<T extends z.ZodTypeAny>(schema: T): ProcedureBuilder<TInput, T> {
    this._output = schema as any;
    return this as any;
  }

  handler(fn: (args: { input: z.infer<TInput> }) => Promise<z.infer<TOutput>>): ProcedureBuilder<TInput, TOutput> {
    this._handler = fn as any;
    return this as any;
  }

  build(): ProcedureDefinition<TInput, TOutput> {
    if (!this._input) throw new Error('Procedure must have an input schema');
    if (!this._output) throw new Error('Procedure must have an output schema');
    if (!this._handler) throw new Error('Procedure must have a handler');

    return {
      _input: this._input,
      _output: this._output,
      handler: this._handler
    };
  }
}

type ProcedureBuilderValue = ProcedureBuilder<any, any> | ProcedureDefinition<any, any> | RouterBuilder<any>;

function isProcedureBuilder(value: ProcedureBuilderValue): value is ProcedureBuilder<any, any> {
  return value instanceof ProcedureBuilder;
}

function isRouterBuilder(value: ProcedureBuilderValue): value is RouterBuilder<any> {
  return value instanceof RouterBuilder;
}

class RouterBuilder<T extends RouterDefinition = {}> {
  private _procedures: T;

  constructor(procedures: Record<string, any> = {}) {
    const built: any = {};
    for (const [key, value] of Object.entries(procedures)) {
      if (isProcedureBuilder(value)) {
        built[key] = value.build();
      } else if (isRouterBuilder(value)) {
        built[key] = value.build();
      } else {
        built[key] = value;
      }
    }
    this._procedures = built;
  }

  procedure(name: string): ProcedureBuilder {
    const builder = new ProcedureBuilder();
    const originalBuild = builder.build.bind(builder);

    builder.build = () => {
      const proc = originalBuild();
      (this._procedures as any)[name] = proc;
      return proc;
    };

    return builder;
  }

  merge<TOther extends RouterDefinition>(other: RouterBuilder<TOther>): RouterBuilder<T & TOther> {
    const merged: any = {
      ...this._procedures,
      ...other._procedures
    };
    return new RouterBuilder(merged) as any;
  }

  build(): T {
    return this._procedures;
  }
}

type InferRouter<T> = {
  [K in keyof T]: T[K] extends ProcedureBuilder<infer I, infer O>
    ? ProcedureDefinition<I, O>
    : T[K] extends ProcedureDefinition<any, any>
      ? T[K]
      : T[K] extends RouterBuilder<infer R>
        ? InferRouter<R>
        : T[K] extends RouterDefinition
          ? InferRouter<T[K]>
          : never
};

export function initUsagi() {
  return {
    router: <T extends Record<string, ProcedureBuilderValue> = {}>(procedures?: T): RouterBuilder<InferRouter<T>> => {
      return new RouterBuilder(procedures || {}) as any;
    },
    get procedure() {
      return new ProcedureBuilder();
    }
  };
}

export { ProcedureBuilder, RouterBuilder };
