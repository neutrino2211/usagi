# usagi
The rabbitmq communication broker for all backend modules

## Example
```ts
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

let instance = new Instance("amqp://guest:guest@localhost:5672/");

const broker = instance.createBroker("entities");
await broker.init();
const result = await broker.call<EntitiesResult>("identify", { text: "I was with Barack Obama and Taylor Swift the other day" });
expect(result).toBeDefined(); // should be true
expect(result.entities).toBeDefined(); // should be true
expect(result.entities["Barack Obama"]).toBeDefined(); // should be true
expect(result.entities["Taylor Swift"]).toBeDefined(); // should be true
```
