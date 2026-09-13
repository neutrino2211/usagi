import { z } from 'zod';
import * as amqp from 'amqplib';
import { v4 as uuidV4 } from 'uuid';
import { ProcedureDefinition, RouterDefinition } from './types';

export interface ServiceDefinition {
  queue: string;
  procedures: Record<string, ProcedureDefinition>;
}

export interface PoolConfig {
  connectionString: string;
  poolSize?: number;
  timeout?: number;
}

export class ServiceRegistry {
  private services: Map<string, ServiceDefinition> = new Map();
  private connections: amqp.ChannelModel[] = [];
  private channels: amqp.Channel[] = [];
  private currentChannelIndex = 0;
  private replyQueues: string[] = [];
  private pendingCalls: Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }> = new Map();
  private consumers: amqp.Replies.Consume[] = [];

  constructor(private config: PoolConfig) {}

  register(name: string, queue: string, router: RouterDefinition): void {
    const procedures: Record<string, ProcedureDefinition> = {};

    for (const [key, value] of Object.entries(router)) {
      if ('_input' in value && '_output' in value && 'handler' in value) {
        procedures[key] = value as ProcedureDefinition;
      }
    }

    this.services.set(name, { queue, procedures });
  }

  async init(): Promise<void> {
    const poolSize = this.config.poolSize || 1;

    for (let i = 0; i < poolSize; i++) {
      const connection = await amqp.connect(this.config.connectionString);
      const channel = await connection.createChannel();

      this.connections.push(connection);
      this.channels.push(channel);

      const replyQueue = `usagi.reply.${uuidV4()}`;
      await channel.assertQueue(replyQueue, { durable: false });
      this.replyQueues.push(replyQueue);

      const consumer = await channel.consume(replyQueue, (msg) => {
        if (msg) {
          const content = JSON.parse(msg.content.toString());
          const pending = this.pendingCalls.get(content._id);
          if (pending) {
            pending.resolve(content.data);
            this.pendingCalls.delete(content._id);
          }
          channel.ack(msg);
        }
      });

      this.consumers.push(consumer);
    }
  }

  getService(name: string): ServiceDefinition | undefined {
    return this.services.get(name);
  }

  async call<T>(service: string, procedure: string, data: any): Promise<T> {
    const serviceDef = this.services.get(service);
    if (!serviceDef) {
      throw new Error(`Service '${service}' not registered`);
    }

    const procedureDef = serviceDef.procedures[procedure];
    if (!procedureDef) {
      throw new Error(`Procedure '${procedure}' not found in service '${service}'`);
    }

    const channel = this.channels[this.currentChannelIndex % this.channels.length];
    const replyQueue = this.replyQueues[this.currentChannelIndex % this.channels.length];
    this.currentChannelIndex = (this.currentChannelIndex + 1) % this.channels.length;

    const correlationId = uuidV4();
    const message = {
      _id: correlationId,
      procedure,
      data,
      replyTo: replyQueue
    };

    return new Promise<T>((resolve, reject) => {
      this.pendingCalls.set(correlationId, { resolve, reject });

      channel.sendToQueue(
        serviceDef.queue,
        Buffer.from(JSON.stringify(message)),
        { correlationId, replyTo: replyQueue }
      );

      const timeout = this.config.timeout || 30000;
      setTimeout(() => {
        if (this.pendingCalls.has(correlationId)) {
          this.pendingCalls.delete(correlationId);
          reject(new Error(`Call to ${service}.${procedure} timed out after ${timeout}ms`));
        }
      }, timeout);
    });
  }

  async handleMessages(serviceName: string): Promise<void> {
    const serviceDef = this.services.get(serviceName);
    if (!serviceDef) {
      throw new Error(`Service '${serviceName}' not registered`);
    }

    const channel = this.channels[0];

    await channel.assertQueue(serviceDef.queue, { durable: true });

    await channel.consume(serviceDef.queue, async (msg) => {
      if (msg) {
        const content = JSON.parse(msg.content.toString());
        const { procedure, data, replyTo, _id } = content;

        const procedureDef = serviceDef.procedures[procedure];
        if (procedureDef) {
          try {
            const result = await procedureDef.handler({ input: data });
            channel.sendToQueue(
              replyTo,
              Buffer.from(JSON.stringify({ _id, data: result })),
              { correlationId: _id }
            );
          } catch (error) {
            channel.sendToQueue(
              replyTo,
              Buffer.from(JSON.stringify({ _id, error: (error as Error).message })),
              { correlationId: _id }
            );
          }
        }

        channel.ack(msg);
      }
    });
  }

  async teardown(): Promise<void> {
    for (const consumer of this.consumers) {
      await this.channels[0].cancel(consumer.consumerTag);
    }

    for (const channel of this.channels) {
      await channel.close();
    }

    for (const connection of this.connections) {
      await connection.close();
    }

    this.channels = [];
    this.connections = [];
    this.consumers = [];
    this.replyQueues = [];
  }
}
