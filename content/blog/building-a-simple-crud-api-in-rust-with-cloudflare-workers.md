---
external: false
title: "A Simple CRUD API in Rust with Cloudflare Workers, Cloudflare KV, and the Rust Router"
description: "In this tutorial, software engineer Damian Esteban teaches you how to build a CRUD API using Rust and Cloudflare Workers. Learn how to leverage Rust's speed and safety to create low-latency, resilient serverless functions. The guide covers architecting endpoints, serializing and deserializing data, and integrating with Workers KV. Whether you're new to Rust or an experienced developer, this tutorial will level up your API development skills and show you how Rust supercharges Cloudflare Workers."
ogImagePath: "https://cdn.damianesteban.dev/rusty-robot.webp"
date: 2023-08-20
---

# Introduction

Greetings readers! I had originally planned to cover Cloudflare Durable Objects in this post. However, I've decided to hold off on that topic until we dig into some more Rust basics for Cloudflare Workers.

I'm really enjoying my journey with Rust so far. My Swift experience makes picking up Rust fairly intuitive, though naturally there are differences like Rust's unique memory management model. We may do a Swift vs Rust comparison another time - that would be cool.

For now, I want to focus on building simple CRUD APIs with Rust and Workers. We will use the Cloudflare [worker crate](https://crates.io/crates/worker) to build our API. The worker crate is a framework for building Cloudflare Workers in Rust. It provides a high-level API for interacting with the Cloudflare Workers API. Please note that this library is still in development, so some things may change in the future. See the [GitHub repo](https://github.com/cloudflare/workers-rs#notes-and-faq) for more information.

For routing and request handling, we'll utilize the handy [Router](https://github.com/cloudflare/workers-rs#or-use-the-router) from the worker crate. It provides a flexible API for defining routes and handlers to get up and running quickly.

To serialize and deserialize data, we'll employ the popular [serde](https://crates.io/crates/serde) crate along with [serde_json](https://crates.io/crates/serde_json). This will allow us to easily convert between Rust types and JSON when working with API requests and responses.

Finally, for peristence we'll use [Cloudflare KV](https://developers.cloudflare.com/workers/runtime-apis/kv/).

By leveraging the Router for concise routing and serde for data serialization, we get powerful libraries purpose-built for API development in Workers. This combination sets us up for productive and idiomatic API development in Rust.

By the end, you'll see how straightforward it is to create fast, resilient APIs in Rust on the Workers platform.

Let's get started.

# Why Rust?

![Damian Esteban's Rusty Robot](https://cdn.damianesteban.dev/rusty-robot.webp)

Rust is a modern systems programming language that emphasizes safety, speed, and concurrency. With its excellent performance and low resource usage, Rust is a great fit for building highly scalable serverless functions on platforms like Cloudflare Workers.

One key advantage of using Rust for Cloudflare Workers is its excellent [WebAssembly (WASM)](https://webassembly.org/) support. Rust code can be efficiently compiled to WASM bytecode and executed with near-native performance in the browser. This makes it a fantastic fit for the serverless computing model of Cloudflare Workers. The generated WASM module is uploaded to Cloudflare's edge network during deployment, where it can quickly scale to handle requests across global data centers. By leveraging Rust and WASM, we get safe, fast code with tiny bundles that load quickly. For our API, this means low-latency and resilient performance for end users, while keeping costs low on the serverless backend. Rust's lightweight threading model also shines in the concurrent environment of Workers.

In this tutorial, we'll use Rust and Workers to build a simple CRUD (Create, Read, Update, Delete) API that allows us to manage data for an animal rescue organization.

# Overview

Our API will support the following endpoints:

- `POST /rescues` - Create a new animal rescue record
- `PUT /rescues/:id` - Update an existing rescue record
- `DELETE /rescues/:id` - Delete a rescue record
- `GET /rescues` - Get all rescue records
- `GET /rescue/:id` - Get a rescue record by ID
- `GET /shared-data` - Get some shared data accessible across requests

We'll store the rescue records in Workers KV, a fast key-value data store provided by Cloudflare.

For the API code, we'll use:

- [worker](https://crates.io/crates/worker) - The Rust framework for writing Cloudflare Workers
- [serde](https://crates.io/crates/serde) - Popular Rust serialization/deserialization library
- [serde_json](https://crates.io/crates/serde_json) - Serde JSON support
- [futures](https://docs.rs/futures/latest/futures/) - Asynchronous programming in Rust

# Get Started

To get started, create a new Cloudflare Workers project with Rust support:

```shell
npm init cloudflare project_name worker-rust
cd project_name
```

Take a look in `src/lib.rs`. You'll see a simple "Hello World" example. This is the entry point for our Worker. We'll replace this with our API code. Be sure to add `serde` and `serde_json` to your project:

```shell
cargo add serde
cargo add serde_json
```

# Implementing the API

**NOTE:** _Please see [this article](https://blog.damianesteban.dev/blog/building-a-yoga-graphql-server-with-cloudflare-workers/) if you need help setting up Workers KV for your project. The final code at the end of the article contains comments explaining each section. You can find the full code [here](https://github.com/damianesteban/cloudflare-workers-rust-crud-api)._

Let's walk through the code step-by-step.

First we import the required crates:

```rust
use worker::*;
use serde::{Deserialize, Serialize};
use serde_json::to_string;
use futures::future::join_all; // For async iteration
```

Next we define a few structs to represent the data:

```rust
// This is a shared data struct that we will pass to the router
struct SharedData {
    name: String,
}

// This is the struct that we will use to store and retrieve data from KV. It implements Serialize and Deserialize
#[derive(Clone, Debug, Deserialize, Serialize)]
struct AnimalRescue {
    id: u8,
    name: String,
    age: u8,
    species: String,
}

// This is the struct that we will use to update data in KV. It implements Serialize and Deserialize
#[derive(Clone, Debug, Deserialize, Serialize)]
struct AnimalRescueUpdate {
    name: String,
    age: u8,
    species: String,
}
```

`SharedData` holds some data we want to share across requests. I've added this here as an example of the Rust Router's support for storing state. We'll use this later to demonstrate how to access shared data from a request handler.

`AnimalRescue` will be used to represent individual rescue records, and`AnimalRescueUpdate` will be used to upload a record. We derive `Serialize` and `Deserialize` so it can easily be converted to/from JSON.

In the main worker module, we first grab the shared data and create a router:

```rust
#[event(fetch)]
pub async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {

  let shared_data = SharedData {
    name: "Rusty".to_string(),
  };

  let router = Router::with_data(shared_data);
  router.run(req, env).await
}
```

Then we configure the CRUD routes on the router:

```rust
router
  .get("/shared-data", |_, ctx| {
      let shared_data = ctx.data.name;
      Response::ok(shared_data)
  })
  .post_async("/rescues", |mut req, ctx| async move {
    // Create rescue logic
  })
  .get_async("/rescues/:id", |req, ctx| async move {
    // Read rescue logic
  })
  .get_async("/rescues", |req, ctx| async move {
    // Read all rescues logic
  })
  .delete_async("/rescues/:id", |req, ctx| async move {
    // Delete rescue logic
  })
  .put_async("/rescues/:id", |mut req, ctx| async move {
    // Update rescue logic
  })
```

To handle POST requests, we deserialize the JSON body, write to KV, and return the created record:

```rust
  .post_async("/rescues", |mut req, ctx| async move {
      let kv = ctx.kv("Animal_Rescues_Rusty_KV")?;
      let body = req.json::<AnimalRescue>().await?;
      let value = to_string(&body)?;
      kv.put(&body.id.to_string(), value)?.execute().await?;
      Response::from_json(&body)
  })

```

For GET, we fetch the record or records from KV and handle if missing:

```rust
  .get_async("/rescues/:id", |_req, ctx | async move {
        if let Some(id) = ctx.param("id") {
            let kv = ctx.kv("Animal_Rescues_Rusty_KV")?;
            return match kv.get(id).json::<AnimalRescue>().await? {
                Some(animal) => Response::from_json(&animal),
                None => Response::error("Animal not found", 404)
            };
        }
        Response::error("Animal not found", 404)
    })
    .get_async("/rescues", |_req, ctx | async move {
        let kv = ctx.kv("Animal_Rescues_Rusty_KV")?;

        let keys = kv
            .list()
            .execute()
            .await?
            .keys;

        console_debug!("{:?}", keys);

        let key_names = keys
            .into_iter()
            .map(|key| key.name)
            .collect::<Vec<String>>();

        console_debug!("{:?}", key_names);

        let futures = key_names
            .iter()
            .map(|key| kv.get(key).json::<AnimalRescue>());

        let animals = join_all(futures)
            .await
            .into_iter()
            .filter_map(|animal| animal.ok())
            .collect::<Vec<_>>().into_iter()
            .map(|animal| animal)
            .collect::<Vec<_>>();

        let final_result = Response::from_json(&animals);
        console_debug!("Final Result: \n {:?}", &final_result);

        final_result
    })
```

For PUT we fetch and update the record:

```rust
 .put_async("/rescues/:id", |mut req, ctx| async move {
          if let Some(id) = ctx.param("id") {
              let kv = ctx.kv("Animal_Rescues_Rusty_KV")?;
              let body = req.json::<AnimalRescueUpdate>().await?;
              if kv.get(id).json::<AnimalRescue>().await?.is_none() {
                  return Response::error("Animal not found", 404);
              }

              let new_animal = AnimalRescue {
                  id: id.parse::<u8>().unwrap(),
                  name: body.name,
                  age: body.age,
                  species: body.species,
              };

              let value = to_string(&new_animal)?;
              kv.put(&id, value)?.execute().await?;
              return Response::from_json(&new_animal);
          }
          Response::error("Animal not found", 404)
      })
```

Finally, for DELETE we fetch and delete the record:

```rust
.delete_async("/rescues/:id", |_req, ctx| async move {
    if let Some(id) = ctx.param("id") {
        let kv = ctx.kv("Animal_Rescues_Rusty_KV")?;
        return match kv.delete(id).await {
            Ok(_) => Response::ok("").map(|resp| resp.with_status(204)),
            Err(e) => Response::error(e.to_string(), 404)
        };
    }
    Response::error("Animal not found", 404)
})
```

**Here it is all together with comments explaining each section:**

```rust
use worker::*;
use serde::{Deserialize, Serialize};
use serde_json::to_string;
use futures::future::join_all;

// This is a shared data struct that we will pass to the router
struct SharedData {
    name: String,
}

// This is the struct that we will use to store and retrieve data from KV. It implements Serialize and Deserialize
#[derive(Clone, Debug, Deserialize, Serialize)]
struct AnimalRescue {
    id: u8,
    name: String,
    age: u8,
    species: String,
}

// This is the struct that we will use to update data in KV. It implements Serialize and Deserialize
#[derive(Clone, Debug, Deserialize, Serialize)]
struct AnimalRescueUpdate {
    name: String,
    age: u8,
    species: String,
}

#[event(fetch)]
async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    // Shared data is accessible across requests
    let shared_data = SharedData {
        name: "Rustacean".to_string(),
    };

    // Create a new router with the shared data
    let router = Router::with_data(shared_data);

    // Router definition
    router
        .get("/shared-data", |_, ctx| {
             // Get the shared data from the context. This is available because we used with_data above.
            let shared_data = ctx.data.name;
            // Return the response
            Response::ok(shared_data)
        })
        .post_async("/rescues", |mut req, ctx| async move {
             // Get the KV namespace
            let kv = ctx.kv("Animal_Rescues_Rusty_KV")?;
            // Get the body of the request - Note that AnimalRescue implements Deserialize
            let body = req.json::<AnimalRescue>().await?;
            // Serialize the body to a string
            let value = to_string(&body)?;
            // Store the value in KV
            kv.put(&body.id.to_string(), value)?.execute().await?;
            // Return the response
            Response::from_json(&body)
        })
        .delete_async("/rescues/:id", |_req, ctx| async move {
            // Get the id from the request, we use if let to check if the id exists
            if let Some(id) = ctx.param("id") {
                // Get the KV namespace
                let kv = ctx.kv("Animal_Rescues_Rusty_KV")?;
                // Delete the value from KV. In this case,
                // we use the id as the key and return a match statement in case of an error.
                return match kv.delete(id).await {
                    // ! NOTE: I could not find a way to return a 204 No Content response, so this has an empty body.
                    Ok(_) => Response::ok("").map(|resp| resp.with_status(204)),
                    Err(e) => Response::error(e.to_string(), 404)
                };
            }
            Response::error("Animal not found", 404)
        })
        .put_async("/rescues/:id", |mut req, ctx| async move {
            // Get the id from the request, we use if let to check if the id exists
            if let Some(id) = ctx.param("id") {
                // Get the KV namespace
                let kv = ctx.kv("Animal_Rescues_Rusty_KV")?;
                // Get the body of the request - Note that AnimalRescueUpdate implements Deserialize
                let body = req.json::<AnimalRescueUpdate>().await?;
                // Check to see if the id exists in KV
                if kv.get(id).json::<AnimalRescue>().await?.is_none() {
                    // If the id does not exist, return an error
                    return Response::error("Animal not found", 404);
                }

                // Create a new AnimalRescue struct from the body and id
                let new_animal = AnimalRescue {
                    id: id.parse::<u8>().unwrap(),
                    name: body.name,
                    age: body.age,
                    species: body.species,
                };

                // Serialize new_animal to a string
                let value = to_string(&new_animal)?;
                // Store the value in KV
                kv.put(&id, value)?.execute().await?;
                // Return the response
                return Response::from_json(&new_animal);
            }
            Response::error("Animal not found", 404)
        })
        .get_async("/rescues/:id", |_req, ctx | async move {
            // Get the id from the request, we use if let to check if the id exists
            if let Some(id) = ctx.param("id") {
                // Get the KV namespace
                let kv = ctx.kv("Animal_Rescues_Rusty_KV")?;
                // Get the value from KV. In this case,
                // we use the id as the key and return a match statement because the value may not exist.
                return match kv.get(id).json::<AnimalRescue>().await? {
                    Some(animal) => Response::from_json(&animal),
                    None => Response::error("Animal not found", 404)
                };
            }
            Response::error("Animal not found", 404)
        })
        .get_async("/rescues", |_req, ctx | async move {
            // Get the KV namespace
            let kv = ctx.kv("Animal_Rescues_Rusty_KV")?;

            // Get all the keys from KV
            let keys = kv
                .list()
                .execute()
                .await?
                .keys;

            console_debug!("{:?}", keys);

            // Create a Vec of only the key names
            let key_names = keys
                .into_iter()
                .map(|key| key.name)
                .collect::<Vec<String>>();

            console_debug!("{:?}", key_names);

            // Create a Vec of the futures, each future will return an AnimalRescue from KV.

            // The JavaScript code most comprarable to this is:
            // -----------------------------------------------
            // const values = keys.map(key => key.name);
            // const futures = values.map(key => kv.get(key).json());
            // const animals = await Promise.all(futures);
            // const final_result = new Response(JSON.stringify(animals));
            // return final_result;
            // -----------------------------------------------

            let futures = key_names
                .iter()
                .map(|key| kv.get(key).json::<AnimalRescue>());

            // Wait for all the futures to complete. This is similar to Promise.all in JavaScript.
            let animals = join_all(futures)
                .await
                .into_iter()
                .filter_map(|animal| animal.ok())
                .collect::<Vec<_>>().into_iter()
                .map(|animal| animal)
                .collect::<Vec<_>>();

            // Create a response from the animals Vec, wrapped in a Result type.
            let final_result = Response::from_json(&animals);
            console_debug!("Final Result: \n {:?}", &final_result);

            final_result
        })
        .run(req, env).await
}

```

# Conclusion

In this post, we saw how Rust and Cloudflare Workers enable you to build fast, resilient APIs with minimal effort. By leveraging Rust's performance and safety guarantees combined with Workers serverless architecture, you can create APIs that scale automatically while keeping costs low.

The worker framework and crate allow rapid API development in idiomatic Rust style. Serde provides ergonomic serialization to convert between Rust types and JSON for API requests/responses. And Workers KV offers a fast, low-latency database for the edge.

I hope you enjoyed this post. If you have any questions or comments, please reach out on Twitter [@estebanrules](https://twitter.com/estebanrules). Next up is [Cloudflare D1](https://developers.cloudflare.com/d1/). I can't wait!
