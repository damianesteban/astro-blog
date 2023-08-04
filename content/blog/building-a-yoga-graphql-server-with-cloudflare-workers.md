---
external: false
title: "Building a Serverless GraphQL Yoga Server with TypeScript on Cloudflare Workers with Cloudflare KV"
description: "Join Damian Esteban in exploring how to build a GraphQL Yoga server using TypeScript and deploying it on Cloudflare Workers with Cloudflare KV for persistence."
ogImagePath: "https://cdn.damianesteban.dev/orange-superhero.webp"
date: 2023-07-28
---

Hello, friends! I'm thrilled to launch a series of blog posts focused on [Cloudflare Workers](https://workers.cloudflare.com/), an innovative platform that's revolutionizing the web development landscape.

Cloudflare Workers is a trailblazer in edge computing, executing code near the user for enhanced speed and security. It's like having a superhuman guardian for your web application, ensuring rapid and secure delivery. The next time I have the opportunity to build a platform from scratch, I plan to make heavy use of Cloudflare Workers. If you are interested in knowing more, please reach out to me 😉.

![Damian Esteban - Cloudflare Workers Superhero](https://cdn.damianesteban.dev/orange-superhero.webp)

As a huge supporter of this platform, I'm eager to showcase its capabilities. In this series, we'll explore Cloudflare Workers, experiment with its features like [KV](https://developers.cloudflare.com/workers/runtime-apis/kv/), [Durable Objects](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/), [Cloudflare Queues](https://developers.cloudflare.com/queues/), and [D1](https://developers.cloudflare.com/d1/).

In this inaugural post, I'll guide you through building a simple [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server) server with [TypeScript](https://www.typescriptlang.org/) on Cloudflare Workers. Why? Because my passion for GraphQL is as strong as my admiration for Cloudflare Workers, and these two technologies harmonize perfectly.

Yoga, along with numerous other GraphQL Projects, is maintained by [The Guild](https://the-guild.dev/). Their approach to software design is outstanding and I am a big fan. In a subsequent post, I will integrate [GraphQL over SSE]( https://the-guild.dev/blog/graphql-over-sse) into our project.

In this tutorial, we've chosen to use 'animal rescues' as our API's data. This choice is not arbitrary; I am currently developing an open-source Animal Rescue & Shelter Management application. This project is a testament to my commitment to leveraging technology for social good, and it provides a practical context for this tutorial. By sharing this with you, I hope to inspire more engineers to contribute to open-source projects and use their skills to make a positive impact.

Let's do this.

## Step 1: Setting Up Your Project

Firstly, let's initiate our project with [c3](https://developers.cloudflare.com/pages/get-started/c3). Make sure to select "Hello World" for a blank slate and choose TypeScript.

```shell
npm create cloudflare
```

Next, install the necessary libraries:

```shell
npm install graphql graphql-yoga
```

Finally, let's create two KV namespaces:

```shell
wrangler kv:namespace create Animal_Rescues_KV
```

```shell
wrangler kv:namespace create Animal_Rescues_KV --preview
```

You will see the following output in your terminal:

```shell
 ⛅️ wrangler 3.0.0 (update available 3.4.0)
-----------------------------------------------------
🌀 Creating namespace with title "damp-block-4742-Animal_Rescues_KV"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "Animal_Rescues_KV", id = "6e07585309964f36a11e058aadcc8968" }
```

```shell
 ⛅️ wrangler 3.0.0 (update available 3.4.0)
-----------------------------------------------------
🌀 Creating namespace with title "damp-block-4742-Animal_Rescues_KV_preview"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "Animal_Rescues_KV", preview_id = "d3c1f3203ee24db4849194701e6ee741" }
```

Go ahead and edit your `wrangler.toml` file, and add the KV namespaces:

```toml
name = "damp-block-4742"
main = "src/worker.ts"
compatibility_date = "2023-07-24"

[[kv_namespaces]]
binding = "Animal_Rescues_KV"
id = "6e07585309964f36a11e058aadcc8968"
preview_id = "d3c1f3203ee24db4849194701e6ee741"
```

## Step 2: Creating Your GraphQL Server

Edit the `src/worker.ts` file and add the following code:

```typescript
import { createSchema, createYoga } from 'graphql-yoga';
import gql from 'graphql-tag';
import { nanoid } from 'nanoid';

// Workers Env
export interface Env {
  Animal_Rescues_KV: KVNamespace;
}

// Create Yoga server with schema and resolvers
const yoga = createYoga<Env>({
  schema: createSchema({
    typeDefs: gql`

      enum AnimalRescueSpecies {
        DOG
        CAT
      }
      type AnimalRescue {
        id: ID!
        name: String!
        species: AnimalRescueSpecies!
      }

      type Query {
        animalRescue(id: ID!): AnimalRescue
        animalRescues: [AnimalRescue]
      }

      type Mutation {
        addAnimalRescue(name: String!, species: AnimalRescueSpecies): AnimalRescue
      }
    `,
    resolvers: {
      Query: {
        animalRescue: async (_, { id }, { Animal_Rescues_KV }) => {
          const value = await Animal_Rescues_KV.get(id);
          console.log('value', value);
          return JSON.parse(value!);
        },
        animalRescues: async (_, {}, { Animal_Rescues_KV }) => {
          const records = await Animal_Rescues_KV.list();

          const allRecords = await Promise.all(records.keys.map((k) => Animal_Rescues_KV.get(k.name)));
          const parsed = allRecords.map((r) => JSON.parse(r!));
          return parsed;
        },
      },
      Mutation: {
        addAnimalRescue: async (_, { name, species }, { Animal_Rescues_KV }) => {
          const newAnimalRescue = {
            name,
            species,
            id: nanoid(),
          };
          await Animal_Rescues_KV.put(newAnimalRescue.id, JSON.stringify(newAnimalRescue));
          return newAnimalRescue;
        },
      },
    },
  }),
});

// Fetch handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return yoga.fetch(request, env);
  },
};
```

Here's what we did:

1. Added the `Animal_Rescues_KV` to the `Env` interface.
2. Created our schema and resolvers. Notice how `Animal_Rescues_KV` is available for us by default in the context.
3. In our resolvers, we use `Animal_Rescues_KV` as out datasource. We will go into more detail about `KV` in another blog post.
4. Finally, we created our GraphQL Yoga server and added it to our [fetch handler](https://developers.cloudflare.com/workers/runtime-apis/fetch/). It's amazing how easy it is to get up and running with GraphQL Yoga.

## Step 4: Deployment

Provided you're logged in with [wrangler](https://developers.cloudflare.com/workers/wrangler/), you only need to run the following:

```shell
wrangler publish
```

Our GraphQL Yoga server is now running on Cloudflare Workers. Visit `https://your-worker-name.<your-account>.workers.dev/graphql` and you'll see the [GraphiQL](https://github.com/graphql/graphiql) interface with your schema. Go ahead and add some data with a mutation and then perform a query. It works!


## Conclusion

In this tutorial, we've explored how to build a GraphQL Yoga server with TypeScript + KV, and deploy it on Cloudflare Workers. This setup leverages the power of GraphQL and the scalability of serverless computing. I hope you find this tutorial helpful, and I encourage you to delve deeper into these technologies. If you have any questions, feel free to reach out to me on [Twitter](https://twitter.com/estebanrules). In our next post, we will explore [Durable Objects](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/). I'm excited!