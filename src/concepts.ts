import { conceptSet, registerConcept } from "@mit-sdg/sync-engine/assembly";
import songRegisteringSpec from "@design/concepts/SongRegistering.md" with { type: "text" };
import { BadLink, SongRegisteringConcept } from "./concepts/SongRegistering.ts";
import matchingSpec from "@design/concepts/Matching.md" with { type: "text" };
import { MatchingConcept } from "./concepts/Matching.ts";

const songRegistering = registerConcept({
  class: SongRegisteringConcept,
  spec: songRegisteringSpec,
  refusals: { BAD_LINK: BadLink },
});

const matching = registerConcept({
  class: MatchingConcept,
  spec: matchingSpec,
});

export const applicationConceptSet = conceptSet({
  SongRegistering: songRegistering,
  Matching: matching,
});

export const { concepts } = applicationConceptSet;
