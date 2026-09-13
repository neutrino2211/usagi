import { Instance } from "../src";

const instance = new Instance("amqp://guest:guest@localhost:5672/")

async function reclassify(replaced: any, text: string) {
    const broker = instance.createBroker("declassifier")
    await broker.init();

    const r = await broker.call("reclassification", {
        text: text,
        replaced_words: replaced
    });
    
    console.log(r)
}

async function main() {
    const broker = instance.createBroker("declassifier")
    await broker.init();

    const result = await broker.call<any>("declassification", {
        text: "I saw August Alsina and Taylor Swift in late November, last year"
    })

    console.log(result)

    await reclassify(result.replaced_words, result.text)
    instance.teardown();
}

main()