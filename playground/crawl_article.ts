import { Instance } from "../src";

const instance = new Instance("amqp://guest:guest@localhost:5672/")

async function main() {
    const broker = instance.createBroker("triggered_crawler");
    await broker.init();

    const result = await broker.call<any>("article_crawl", {
        article: "https://twitter.com/halalwisdom/status/1709361485225529765"
    })

    console.log(result)
    instance.teardown();
}

main()