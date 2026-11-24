import { expect, test } from "bun:test";
import { MongoServerError, type Db } from "mongodb";
import { SessioningConcept, SESSION_SECONDS } from "../concepts/Sessioning.ts";
import { buildAccounts } from "../sandbox/accounts.ts";

test("account endpoints verify credentials before issuing a session", async () => {
  const rows = new Map<string, { _id: string; verifier: string }>();
  const db = {
    collection: () => ({
      async findOne({ _id }: { _id: string }) {
        return rows.get(_id) ?? null;
      },
      async insertOne(row: { _id: string; verifier: string }) {
        if (rows.has(row._id)) throw new MongoServerError({ code: 11000 });
        rows.set(row._id, row);
      },
    }),
  } as unknown as Db;
  const app = buildAccounts(db);
  const credentials = { username: "alex", password: "fixture-password" };
  const registration = await app.invoker.invoke("/auth/register", credentials);
  if (!registration.ok) throw new Error("Registration failed.");
  const { account, session } = registration.value as { account: string; session: string };
  expect(account).toBe("alex");
  expect(rows.get("alex")?.verifier).toStartWith("$argon2id$");
  expect(await app.concepts.Sessioning._active({ session })).toEqual([{ subject: "alex" }]);
  expect((await app.invoker.invoke("/auth/register", credentials)).ok).toBe(false);
  expect((await app.invoker.invoke("/auth/sign-in", { ...credentials, password: "wrong-password" })).ok).toBe(false);

  const login = await app.invoker.invoke("/auth/sign-in", credentials);
  if (!login.ok) throw new Error("Sign-in failed.");
  const nextSession = (login.value as { session: string }).session;
  expect(nextSession).not.toBe(session);
  await app.concepts.Sessioning.end({ session: nextSession });
  expect(await app.concepts.Sessioning._active({ session: nextSession })).toEqual([]);
});

test("sessions expire at the configured lifetime", () => {
  let time = 0;
  const sessions = new SessioningConcept(() => time);
  const { session } = sessions.start({ subject: "sam" });
  expect(sessions._active({ session })).toEqual([{ subject: "sam" }]);
  time = SESSION_SECONDS * 1000;
  expect(sessions._active({ session })).toEqual([]);
});
