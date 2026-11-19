import { assemble } from "@mit-sdg/sync-engine/assembly";
import { applicationConceptSet } from "./concepts.ts";

export function buildApplication() {
  return assemble({
    conceptSet: applicationConceptSet,
    instances: {},
    composition: {},
    // without this a failure only shows up as INTERNAL_ERROR
    rawFaultReporter: ({ error }) => console.error(error),
  });
}
