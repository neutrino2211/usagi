import { z } from 'zod';
import { initUsagi, createClient, ValidationError, ServiceRegistry } from '../src';
import expect from 'expect';

const t = initUsagi();

const IdentifyRequest = z.object({
  text: z.string().min(1)
});

const IdentifyResponse = z.object({
  entities: z.record(z.string(), z.object({
    summary: z.string()
  }))
});

const entitiesRouter = t.router({
  identify: t.procedure
    .input(IdentifyRequest)
    .output(IdentifyResponse)
    .handler(async ({ input }) => {
      return {
        entities: {
          'Taylor Swift': { summary: 'Singer' }
        }
      };
    })
});

const ClassifyRequest = z.object({
  text: z.string(),
  categories: z.array(z.string()).optional()
});

const ClassifyResponse = z.object({
  categories: z.array(z.string()),
  confidence: z.number()
});

const classificationRouter = t.router({
  classify: t.procedure
    .input(ClassifyRequest)
    .output(ClassifyResponse)
    .handler(async ({ input }) => {
      return {
        categories: ['person', 'celebrity'],
        confidence: 0.95
      };
    })
});

const appRouter = t.router({
  entities: entitiesRouter,
  classification: classificationRouter
});

type AppRouter = typeof appRouter;

describe('initUsagi', () => {
  it('creates a procedure builder', () => {
    const procedure = t.procedure;
    expect(procedure).toBeDefined();
  });

  it('creates a router builder', () => {
    const router = t.router<{}>({});
    expect(router).toBeDefined();
  });
});

describe('ProcedureBuilder', () => {
  it('builds a procedure with input, output, and handler', () => {
    const procedure = t.procedure
      .input(z.object({ name: z.string() }))
      .output(z.object({ greeting: z.string() }))
      .handler(async ({ input }) => ({ greeting: `Hello ${input.name}` }));

    const built = procedure.build();
    expect(built._input).toBeDefined();
    expect(built._output).toBeDefined();
    expect(built.handler).toBeDefined();
  });

  it('throws if input schema is missing', () => {
    const procedure = t.procedure
      .output(z.object({ result: z.string() }))
      .handler(async () => ({ result: 'test' }));

    expect(() => procedure.build()).toThrow('Procedure must have an input schema');
  });

  it('throws if output schema is missing', () => {
    const procedure = t.procedure
      .input(z.object({ name: z.string() }))
      .handler(async () => ({ result: 'test' }));

    expect(() => procedure.build()).toThrow('Procedure must have an output schema');
  });

  it('throws if handler is missing', () => {
    const procedure = t.procedure
      .input(z.object({ name: z.string() }))
      .output(z.object({ result: z.string() }));

    expect(() => procedure.build()).toThrow('Procedure must have a handler');
  });
});

describe('RouterBuilder', () => {
  it('builds a router with procedures', () => {
    const router = t.router({
      hello: t.procedure
        .input(z.object({ name: z.string() }))
        .output(z.object({ message: z.string() }))
        .handler(async ({ input }) => ({ message: `Hello ${input.name}` }))
    });

    const built = router.build();
    expect(built.hello).toBeDefined();
    expect(built.hello._input).toBeDefined();
    expect(built.hello._output).toBeDefined();
  });

  it('merges two routers', () => {
    const router1 = t.router({
      hello: t.procedure
        .input(z.object({ name: z.string() }))
        .output(z.object({ message: z.string() }))
        .handler(async ({ input }) => ({ message: `Hello ${input.name}` }))
    });

    const router2 = t.router({
      goodbye: t.procedure
        .input(z.object({ name: z.string() }))
        .output(z.object({ message: z.string() }))
        .handler(async ({ input }) => ({ message: `Goodbye ${input.name}` }))
    });

    const merged = router1.merge(router2);
    const built = merged.build();

    expect(built.hello).toBeDefined();
    expect(built.goodbye).toBeDefined();
  });
});

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry;

  beforeEach(() => {
    registry = new ServiceRegistry({
      connectionString: 'amqp://guest:guest@localhost:5672/',
      poolSize: 1,
      timeout: 2000
    });
  });

  afterEach(async () => {
    await registry.teardown();
  });

  it('registers a service', () => {
    const router = t.router({
      test: t.procedure
        .input(z.object({ x: z.number() }))
        .output(z.object({ result: z.number() }))
        .handler(async ({ input }) => ({ result: input.x * 2 }))
    });

    registry.register('testService', 'test-queue', router.build());

    const service = registry.getService('testService');
    expect(service).toBeDefined();
    expect(service?.queue).toBe('test-queue');
    expect(service?.procedures.test).toBeDefined();
  });

  it('returns undefined for unregistered service', () => {
    const service = registry.getService('nonexistent');
    expect(service).toBeUndefined();
  });

  it('connects to rabbitmq', async () => {
    await registry.init();
    expect(registry).toBeDefined();
  });

  it('throws when calling unregistered service', async () => {
    await registry.init();

    try {
      await registry.call('nonexistent', 'test', {});
      throw new Error('Should have thrown');
    } catch (e) {
      expect((e as Error).message).toContain('not registered');
    }
  });

  it('throws when calling unregistered procedure', async () => {
    await registry.init();

    const router = t.router({
      test: t.procedure
        .input(z.object({ x: z.number() }))
        .output(z.object({ result: z.number() }))
        .handler(async ({ input }) => ({ result: input.x * 2 }))
    });

    registry.register('testService', 'test-queue', router.build());

    try {
      await registry.call('testService', 'nonexistent', { x: 1 });
      throw new Error('Should have thrown');
    } catch (e) {
      expect((e as Error).message).toContain('not found');
    }
  });
});

describe('createClient', () => {
  it('creates a typed client', () => {
    const { client } = createClient<{
      entities: { queue: string; router: typeof entitiesRouter extends { build(): infer R } ? R : never }
    }>({
      connectionString: 'amqp://guest:guest@localhost:5672/'
    });

    expect(client).toBeDefined();
  });
});

describe('ValidationError', () => {
  it('creates a validation error with correct properties', () => {
    const schema = z.object({ name: z.string() });
    const result = schema.safeParse({ name: 123 });

    if (!result.success) {
      const error = new ValidationError('testService', 'testProcedure', 'input', result.error);

      expect(error.service).toBe('testService');
      expect(error.procedure).toBe('testProcedure');
      expect(error.type).toBe('input');
      expect(error.errors).toBeDefined();
      expect(error.name).toBe('ValidationError');
      expect(error.message).toContain('testService');
      expect(error.message).toContain('testProcedure');
      expect(error.message).toContain('input');
    }
  });
});

describe('End-to-end typed procedures', () => {
  it('validates input and output schemas', () => {
    const procedure = t.procedure
      .input(z.object({ text: z.string().min(1) }))
      .output(z.object({ result: z.string() }))
      .handler(async ({ input }) => ({ result: input.text.toUpperCase() }));

    const built = procedure.build();

    const validInput = { text: 'hello' };
    const invalidInput = { text: '' };

    const validResult = built._input.safeParse(validInput);
    const invalidResult = built._input.safeParse(invalidInput);

    expect(validResult.success).toBe(true);
    expect(invalidResult.success).toBe(false);
  });

  it('handler returns correctly typed output', async () => {
    const procedure = t.procedure
      .input(z.object({ x: z.number(), y: z.number() }))
      .output(z.object({ sum: z.number() }))
      .handler(async ({ input }) => ({ sum: input.x + input.y }));

    const built = procedure.build();
    const result = await built.handler({ input: { x: 5, y: 3 } });

    expect(result).toEqual({ sum: 8 });

    const outputResult = built._output.safeParse(result);
    expect(outputResult.success).toBe(true);
  });
});
