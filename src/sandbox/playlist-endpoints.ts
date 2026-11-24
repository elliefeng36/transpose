import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { no, where } from "@mit-sdg/sync-engine/language";
import { concepts } from "../concepts.ts";

const { Playlisting, PlaylistSharing, SongRegistering } = concepts;

// The HTTP host supplies user from the active session before calling these endpoints.
const Create = endpoint("/playlists/create", ({ title, user, playlist }) =>
  receive({ title, user })
    .then(Playlisting.create({ title, owner: user }).responds({ playlist }))
    .afterFlowSettles()
    .where(PlaylistSharing._canView({ playlist, user }).is({ allowed: true }))
    .then(respond({ playlist })),
);

const Invite = endpoint("/playlists/invite", ({ playlist, user, invitee, invite }) =>
  receive({ playlist, user, invitee })
    .then(PlaylistSharing.invite({ playlist, inviter: user, invitee }).responds({ invite }))
    .then(respond({ invite })),
);

const Accept = endpoint("/invites/accept", ({ invite, user }) =>
  receive({ invite, user })
    .then(PlaylistSharing.accept({ invite, user }).responds({ invite }))
    .then(respond({ invite })),
);

const Decline = endpoint("/invites/decline", ({ invite, user }) =>
  receive({ invite, user })
    .then(PlaylistSharing.decline({ invite, user }).responds({ invite }))
    .then(respond({ invite })),
);

const SetPermissions = endpoint("/playlists/permissions", ({ playlist, user, member, canAdd, canRemove }) =>
  receive({ playlist, user, member, canAdd, canRemove })
    .then(PlaylistSharing.setPermissions({ playlist, owner: user, member, canAdd, canRemove }).responds({ playlist }))
    .then(respond({ playlist })),
);

const RemoveMember = endpoint("/playlists/remove-member", ({ playlist, user, member }) =>
  receive({ playlist, user, member })
    .then(PlaylistSharing.removeMember({ playlist, owner: user, member }).responds({ playlist }))
    .then(respond({ playlist })),
);

const Leave = endpoint("/playlists/leave", ({ playlist, user }) =>
  receive({ playlist, user })
    .then(PlaylistSharing.leave({ playlist, member: user }).responds({ playlist }))
    .then(respond({ playlist })),
);

const StopSharing = endpoint("/playlists/stop-sharing", ({ playlist, user }) =>
  receive({ playlist, user })
    .then(PlaylistSharing.stopSharing({ playlist, owner: user }).responds({ playlist }))
    .then(respond({ playlist })),
);

const StartSharing = endpoint("/playlists/start-sharing", ({ playlist, user }) =>
  receive({ playlist, user }).then(
    where(Playlisting._isOwner({ playlist, user }).is({ allowed: false }))
      .then(respond({ error: "Only the playlist owner can start sharing." }))
      .named("denied"),
    where(Playlisting._isOwner({ playlist, user }).is({ allowed: true }))
      .then(PlaylistSharing.startSharing({ playlist, owner: user }).responds({ playlist }))
      .then(respond({ playlist }))
      .named("owner"),
  ),
);

const AddSong = endpoint("/playlists/add-song", ({ playlist, user, id, song }) =>
  receive({ playlist, user, id }).then(
    where(PlaylistSharing._canAdd({ playlist, user }).is({ allowed: false }))
      .then(respond({ error: "You cannot add songs to this playlist." }))
      .named("denied"),
    where(PlaylistSharing._canAdd({ playlist, user }).is({ allowed: true }), no(SongRegistering._record({ id })))
      .then(respond({ error: "This song is no longer registered." }))
      .named("missing"),
    where(PlaylistSharing._canAdd({ playlist, user }).is({ allowed: true }), SongRegistering._record({ id }).is({ song }))
      .then(Playlisting.addSong({ playlist, song, user }))
      .then(respond({ playlist }))
      .named("add"),
  ),
);

const RemoveSong = endpoint("/playlists/remove-song", ({ playlist, user, id, song }) =>
  receive({ playlist, user, id }).then(
    where(PlaylistSharing._canRemove({ playlist, user }).is({ allowed: false }))
      .then(respond({ error: "You cannot remove songs from this playlist." }))
      .named("denied"),
    where(PlaylistSharing._canRemove({ playlist, user }).is({ allowed: true }), no(Playlisting._getStoredSong({ playlist, id })))
      .then(respond({ error: "This song is no longer in the playlist." }))
      .named("missing"),
    where(PlaylistSharing._canRemove({ playlist, user }).is({ allowed: true }), Playlisting._getStoredSong({ playlist, id }).is({ song }))
      .then(Playlisting.removeSong({ playlist, song }))
      .then(respond({ playlist }))
      .named("remove"),
  ),
);

export const playlistEndpoints = {
  Create, Invite, Accept, Decline, SetPermissions, RemoveMember, Leave,
  StartSharing, StopSharing, AddSong, RemoveSong,
};
