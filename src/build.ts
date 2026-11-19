import { assemble } from "@mit-sdg/sync-engine/assembly";
import { SongRegisteringConcept } from "./concepts/SongRegistering.ts";
import { applicationConceptSet } from "./concepts.ts";
import { db } from "./db.ts";

// stand in until the real spotify and youtube calls land
async function lookupSong(): Promise<{ title: string; artist: string; isrc?: string } | null> {
  throw new Error("No platform lookup is configured.");
}
async function matchSong(): Promise<string | null> {
  throw new Error("No platform match is configured.");
}

export function buildApplication() {
  return assemble({
    conceptSet: applicationConceptSet,
    instances: {
      SongRegistering: new SongRegisteringConcept(db, lookupSong, matchSong),
    },
    composition: {},
    // without this a failure only shows up as INTERNAL_ERROR
    rawFaultReporter: ({ error }) => console.error(error),
  });
}
