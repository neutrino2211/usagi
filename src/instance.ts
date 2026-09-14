import { Broker } from "./broker";

export class Instance {
    private brokers: Broker[] = [];

    constructor(private connectionString: string, private socketOptions?: any) {}

    createBroker<T>(module: string): Broker {
        const broker = new Broker(this.connectionString, module, this.socketOptions);
        this.brokers.push(broker);
        return broker
    }

    teardown() {
        this.brokers.forEach(broker => broker.teardown());
    }
}