import assert from "assert";
import { MongoClient } from "mongodb";

const url =
  process.env["MONGODB_URL"] ??
  assert.fail(
    "Missing MONGODB_URL environment variable. Copy .env.example to .env.",
  );

export const client = new MongoClient(url);
export const db = client.db();
