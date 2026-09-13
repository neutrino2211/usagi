import { Instance } from "../src";

async function second () {
    const broker = new Instance("amqp://guest:guest@localhost:5672/").createBroker<{summary: string}>("entities");
    await broker.init();
    const result = await broker.call("identify", { text: "I was with Joe Biden the other day" });
    console.log(result)
    broker.teardown()
}

async function main () {
    const broker = new Instance("amqp://guest:guest@localhost:5672/").createBroker<{summary: string}>("entities");
    await broker.init();
    const result = await broker.call("identify", { text: "I was with August the other day along with a swift in August" });
    console.log(result)
    broker.teardown();
    second()
}

main();