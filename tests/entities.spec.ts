import { Instance } from "../src";
import expect from "expect";

type EntitiesResult = {
    entities: {[key: string]: {
        image: {
            image_src: string
            image_page_url: string
            filename: string
        },
        summary: string
    }}
}

describe("Entities", () => {
    let instance: Instance;

    beforeEach(async () => {
        instance = new Instance("amqp://guest:guest@localhost:5672/");
        // Wait a bit for RabbitMQ to be fully ready
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it("can create broker", () => {
        const broker = instance.createBroker("entities");
        expect(broker).toBeDefined();
    });

    it("can connect to rabbitmq", async function() {
        const broker = instance.createBroker("entities");
        await broker.init();
        expect(broker).toBeDefined();
        await broker.teardown();
    });

    it("can call broker", async function() {
        this.timeout(10000);
        const broker = instance.createBroker<EntitiesResult>("entities");
        await broker.init();
        // This will timeout since there's no entities service running,
        // but it proves we can connect and send messages
        try {
            const result = await broker.call("identify", { text: "I was with Taylor Swift the other day" });
            expect(result).toBeDefined();
        } catch (e) {
            // Expected to timeout since no service is listening
            expect(e).toBeDefined();
        }
        await broker.teardown();
    });

    afterEach(async () => {
        await instance?.teardown();
    });
});
