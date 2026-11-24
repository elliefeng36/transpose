import { reaction, when } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { Playlisting, PlaylistSharing } = concepts;

const InitializeSharing = reaction(({ owner, playlist }) =>
  when(Playlisting.create({ owner }).responds({ playlist }))
    .then(PlaylistSharing.startSharing({ playlist, owner })),
);

export const composition = { InitializeSharing };
