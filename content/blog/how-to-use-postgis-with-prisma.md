---
external: false
title: "How I Got PostGIS Working with Prisma"
description: "Want to use PostGIS with Prisma in your TypeScript project? This guide shows how to enable spatial data support in PostgreSQL, model geolocation fields in Prisma, and use raw SQL to insert and query latitude/longitude data. Ideal for applications involving maps, geocoding, or GIS-based data pipelines."
ogImagePath: "https://cdn.damianesteban.dev/prisma-postgis.webp"
date: 2025-06-16
---

# Introduction

Greetings, readers! While building a geospatial conflict data aggregator, I needed to store and query latitude/longitude points from datasets like UCDP and military installations. That meant using **PostGIS** — the spatial extension for PostgreSQL — and integrating it cleanly into my TypeScript Prisma workflow.

Here’s how I got everything working.

# Steps

## Step 1: Enable PostGIS in Postgres

*Assuming you have a version of PostgreSQL that supports PostGIS (e.g., via macOS Homebrew), install it with:*

```bash
brew install postgis
```
Then, connect to your database using psql (or your tool of choice) and run:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```
This gives you access to spatial types like geometry, spatial functions like ST_GeomFromText(), and indexes like GIST.

## Step 2: Enable Postgres Extensions in Prisma

Open up your `prisma.schema` file and ensure the following configurations are present:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"] // Enable this
  output          = "../prisma/generated"
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [postgis] // Enable this
}
```

Next, define your model:

```
model MilitaryFacility {
  id         String   @id @default(uuid())
  name       String
  reportingBranch       String?
  country    String
  location   Unsupported("geometry(Point,4326)")? // Use Unsupported for geometry
  createdAt  DateTime @default(now())
}
```

Note the use of the Unsupported type for the location field. To work with this, we’ll use a [Prisma Model Extension](https://www.prisma.io/docs/orm/prisma-client/client-extensions).

## Step 3: Create a Prisma Model Extension

The Prisma Extension API is incredibly powerful — I’ve used it for several use cases already. (Blog post on that coming soon.)

Create a file named `prisma-client.ts`. Here’s how I define my Prisma Client instance and the custom insert logic:

```

// Define a type
type MilitaryFacility = {
    id: string;
    name: string;
    reportingBranch: string;
    country: string;
    location: {
        type: 'Point';
        coordinates: [number, number];
    };
};

// Create the extension
export const prisma = new PrismaClient().$extends({
    model: { // model extension
        militaryFacility: {
            async createWithLocation(data: MilitaryFacility) {
                const militaryFacility: MilitaryFacility = {
                    ...data,
                    location: {
                        type: 'Point',
                        coordinates: [data.location.coordinates[0], data.location.coordinates[1]]
                    }
                }

                const point = `POINT(${militaryFacility.location.coordinates[0]} ${militaryFacility.location.coordinates[1]})`

                // NOTE: You need to create the UUID manually, it will not auto-create for you.
                const id = randomUUID();
                await prisma.$queryRaw`
          INSERT INTO "MilitaryFacility" (id, name, "reportingBranch", country, location) VALUES (${id}, ${militaryFacility.name}, ${militaryFacility.reportingBranch}, ${militaryFacility.country}, ST_GeomFromText(${point}, 4326))
                `;
                return { ...militaryFacility, id }
            }
        },
    }
})
```

I could have overridden the default `create` method, but I opted for a custom createWithLocation function to keep spatial logic explicit and clean.

## Step 4: Write Points to the database

I'm using the [Nominatim API](https://nominatim.org/release-docs/latest/api/Search/) to convert place names to longitude/latitude.

```
export async function geocodePlaceName(place: string): Promise<[number, number] | null> {
  const encoded = encodeURIComponent(place);
  const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'milops-aggregator/1.0 (damian@example.com)',
    }
  });

  if (!res.ok) {
    console.error('Failed to fetch from Nominatim:', res.statusText);
    return null;
  }

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const { lat, lon } = data[0];
  return [parseFloat(lat), parseFloat(lon)];
}
```
Here is the script that reads from the CSV, geocodes, and inserts data:

```
(async () => {
  const militaryBases = await extractMilitaryBases(); // This is reading data from a CSV.

  const militaryBasesWithCoordinates = [];

  for (const base of militaryBases) {
    const geocodeResponse = await geocodePlaceName(base.name);

    militaryBasesWithCoordinates.push({
      ...base,
      location: {
        type: 'Point',
        coordinates: geocodeResponse ?? [0, 0],
      }
    });

    await delay(1100); // ~1 sec to be kind to the API
  }

  // You can do parallel inserts here, or sequential if needed
  await Promise.all(militaryBasesWithCoordinates.map(base => prisma.militaryFacility.createWithLocation(base)));
})();
```

# Conclusion

I’m building a geospatial intelligence platform that ingests military datasets, conflict events, and open-source reporting. Prisma + PostGIS gives me the perfect blend of developer ergonomics and spatial power.

Next up: parsing and importing ESRI and shapefile data. I’ll write up my approach once it’s battle-tested.

⸻

Thanks for reading! Got questions or thoughts? Hit me up on Twitter: @estebanrules.
