import { assemble, type LogSink } from "@mit-sdg/sync-engine/assembly";
import type { Db } from "mongodb";
import { composition as transposing } from "./compositions/Transposing.ts";
import { MatchingConcept } from "./concepts/Matching.ts";
import { SongRegisteringConcept } from "./concepts/SongRegistering.ts";
import { applicationConceptSet } from "./concepts.ts";
import { db } from "./db.ts";
import { lookupSong, searchSong } from "./platform-apis.ts";

// the Transposing reactions find the other platform's link, so register doesn't search itself
async function noMatch(): Promise<string | null> {
  return null;
}

export function buildApplication() {
  return buildApplicationOn(db);
}

// The same application on another database. The sandbox (src/sandbox) runs it on a throwaway
// database, with its own endpoints and a log of every action.
export function buildApplicationOn(
  database: Db,
  { composition = {}, ...options }: { composition?: Record<string, unknown>; logSink?: LogSink } = {},
) {
  return assemble({
    conceptSet: applicationConceptSet,
    instances: {
      SongRegistering: new SongRegisteringConcept(database, lookupSong, noMatch),
      Matching: new MatchingConcept(database, searchSong),
    },
    composition: { Transposing: transposing, ...composition },
    // without this a failure only shows up as INTERNAL_ERROR
    rawFaultReporter: ({ error }) => console.error(error),
    ...options,
  });
}
