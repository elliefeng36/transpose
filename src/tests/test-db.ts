import { MongoClient, type Db } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

export type TestDb = { db: Db; close(): Promise<void> };

export async function openTestDb(): Promise<TestDb> {
  let url = process.env["MONGODB_URL"];
  let server: MongoMemoryServer | undefined;
  if (process.env["TEST_MONGO"] === "memory") {
    server = await MongoMemoryServer.create();
    url = server.getUri();
  }
  if (!url) throw new Error("MONGODB_URL is not set; add it to .env.");

  const client = new MongoClient(url, { serverSelectionTimeoutMS: 3000 });
  try {
    await client.connect();
  } catch {
    throw new Error("Could not reach MongoDB.");
  }
  const db = client.db(`test-${crypto.randomUUID()}`);
  return {
    db,
    async close() {
      await db.dropDatabase();
      await client.close();
      if (server !== undefined) {
        await server.stop();
      }
    },
  };
}
