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

describe("Entities (Legacy)", () => {
    let instance: Instance;

    beforeEach(async () => {
        instance = new Instance("amqp://guest:guest@localhost:5672/");
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

    it.skip("can call broker (requires running service)", async function() {
        const broker = instance.createBroker<EntitiesResult>("entities");
        await broker.init();
        const result = await broker.call("identify", { text: "I was with Taylor Swift the other day" });
        expect(result).toBeDefined();
        await broker.teardown();
    });

    afterEach(async () => {
        await instance?.teardown();
    });
});
