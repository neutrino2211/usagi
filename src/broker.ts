import * as amqp from "amqplib";
import EventEmitter from "events";
import { v4 as uuidV4 } from "uuid";

type BrokerJobHandler<T> = (result: T) => void;

const jobs: { [key: string]: BrokerJobHandler<any> } = {};

export class Broker {
    private connection?: amqp.ChannelModel;
    private channel?: amqp.Channel;

    private replyQueue: string = "";

    constructor(private connectionString: string, private module: string) {
        this.replyQueue = this.module+":broker"
    }

    private async handleJob(msg: amqp.ConsumeMessage | null) {
        const obj = JSON.parse(msg?.content.toString('utf-8') || "{}");
        if (obj._id in jobs) {
            jobs[obj._id](obj);
        }

        this.channel?.ack(msg!!);
    }

    async init() {
        this.connection = await amqp.connect(this.connectionString);
        this.channel = await this.connection.createChannel();
        this.channel.assertQueue(this.replyQueue);
        await this.channel.consume(this.replyQueue, (msg) => {
            this.handleJob(msg)
        });
    }

    async teardown() {
        await this.channel?.close();
        await this.connection?.close();
    }

    async call<T>(job: string, data: any): Promise<T> {
        const thisReplyQueueName = this.replyQueue
        const jobDesc = {
            ...data,
            job,
            _id: uuidV4(),
        };

        const r = await this.channel?.assertQueue(thisReplyQueueName, {durable: true});

        return await new Promise<T>((resolve, reject) => {
            jobs[jobDesc._id] = (data: T) => {
                resolve(data);
            }

            const res = this.channel?.sendToQueue(this.module, Buffer.from(JSON.stringify(jobDesc)), {
                replyTo: thisReplyQueueName
            });
        })
    }
}