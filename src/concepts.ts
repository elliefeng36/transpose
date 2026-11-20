import { conceptSet, registerConcept } from "@mit-sdg/sync-engine/assembly";
import songRegisteringSpec from "@design/concepts/SongRegistering.md" with { type: "text" };
import { BadLink, SongRegisteringConcept } from "./concepts/SongRegistering.ts";

const songRegistering = registerConcept({
  class: SongRegisteringConcept,
  spec: songRegisteringSpec,
  refusals: { BAD_LINK: BadLink },
});

export const applicationConceptSet = conceptSet({
  SongRegistering: songRegistering,
});

export const { concepts } = applicationConceptSet;
