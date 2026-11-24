import { MongoServerError, type Collection, type Db } from "mongodb";

export class UsernameTaken extends Error {}
export class InvalidCredentials extends Error {}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validUsername(value: string) {
  return /^[a-z0-9_-]{3,32}$/.test(value);
}

export class AuthenticatingConcept {
  private readonly accounts: Collection<{ _id: string; verifier: string }>;

  constructor(db: Db) {
    this.accounts = db.collection("authenticating.accounts");
  }

  async register({ username, password }: { username: string; password: string }) {
    if (!validUsername(username) || password.length < 8 || password.length > 128) {
      throw new InvalidCredentials("Invalid username or password format.");
    }
    const verifier = await Bun.password.hash(password, { algorithm: "argon2id" });
    try {
      await this.accounts.insertOne({ _id: username, verifier });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new UsernameTaken("That username is already registered.");
      }
      throw error;
    }
    return { account: username };
  }

  async authenticate({ username, password }: { username: string; password: string }) {
    const account = await this.accounts.findOne({ _id: username });
    if (!account || !(await Bun.password.verify(password, account.verifier))) {
      throw new InvalidCredentials("Incorrect username or password.");
    }
    return { account: username };
  }

  async _registered({ username }: { username: string }) {
    return { registered: (await this.accounts.findOne({ _id: username })) !== null };
  }
}
