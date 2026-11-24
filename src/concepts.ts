import { conceptSet, registerConcept } from "@mit-sdg/sync-engine/assembly";
import songRegisteringSpec from "@design/concepts/SongRegistering.md" with { type: "text" };
import playlistingSpec from "@design/concepts/Playlisting.md" with { type: "text" };
import { BadLink, SongRegisteringConcept } from "./concepts/SongRegistering.ts";
import {
  PlaylistingConcept,
  PlaylistExists,
  PlaylistNotFound,
  SongInPlaylist,
  SongNotInPlaylist,
} from "./concepts/Playlisting.ts";
import matchingSpec from "@design/concepts/Matching.md" with { type: "text" };
import { MatchingConcept } from "./concepts/Matching.ts";

const songRegistering = registerConcept({
  class: SongRegisteringConcept,
  spec: songRegisteringSpec,
  refusals: { BAD_LINK: BadLink },
});

const playlisting = registerConcept({
  class: PlaylistingConcept,
  spec: playlistingSpec,
  refusals: {
    PLAYLIST_EXISTS: PlaylistExists,
    PLAYLIST_NOT_FOUND: PlaylistNotFound,
    SONG_IN_PLAYLIST: SongInPlaylist,
    SONG_NOT_IN_PLAYLIST: SongNotInPlaylist,
  },
});
const matching = registerConcept({
  class: MatchingConcept,
  spec: matchingSpec,
});

export const applicationConceptSet = conceptSet({
  SongRegistering: songRegistering,
  Playlisting: playlisting,
  Matching: matching,
});

export const { concepts } = applicationConceptSet;
