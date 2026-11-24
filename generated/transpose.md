<!-- Generated from the Transpose assembly. Do not edit. -->
<!-- Manifest producer: @mit-sdg/sync-engine@1.1.0; concept specification: sync-engine.concept-specification@1; renderer: @mit-sdg/sync-engine@1.1.0. -->

# Transpose — assembled read-back

_Assembled by sync-engine from registered concepts and composition. Edit the concept_
_specifications and composition source, then regenerate this file._

## Concepts

### Matching

Defined in [Matching](../design/concepts/Matching.md), line 1.

#### Actions

- `find(platform: Platform, title: String, artist: String) : returns (match: Match)`
- `reject(match: Match, songId: String) : returns (match: Match)`

#### Queries

- `_url(match: Match) : optional (url: String)`

#### Instances

- `Matching` — instance of `Matching` — [Transpose application types](../design/types.md), line 15.

### PlaylistSharing

Defined in [PlaylistSharing](../design/concepts/PlaylistSharing.md), line 1.

#### Actions

- `startSharing(playlist: Playlist, owner: User) : returns (playlist: Playlist)`
  - Refuses `SHARING_DENIED`: This playlist already has an owner.
- `invite(playlist: Playlist, inviter: User, invitee: User) : returns (invite: Invite)`
  - Refuses `SHARING_DENIED`: The invitation is not allowed.
- `accept(invite: Invite, user: User) : returns (invite: Invite)`
  - Refuses `SHARING_DENIED`: The invitation is unavailable.
- `decline(invite: Invite, user: User) : returns (invite: Invite)`
  - Refuses `SHARING_DENIED`: The invitation is unavailable.
- `setPermissions(playlist: Playlist, owner: User, member: User, canAdd: Flag, canRemove: Flag) : returns (playlist: Playlist)`
  - Refuses `SHARING_DENIED`: The permission change is not allowed.
- `removeMember(playlist: Playlist, owner: User, member: User) : returns (playlist: Playlist)`
  - Refuses `SHARING_DENIED`: The removal is not allowed.
- `leave(playlist: Playlist, member: User) : returns (playlist: Playlist)`
  - Refuses `SHARING_DENIED`: The membership is unavailable.
- `stopSharing(playlist: Playlist, owner: User) : returns (playlist: Playlist)`
  - Refuses `SHARING_DENIED`: The share is unavailable.

#### Queries

- `_canView(playlist: Playlist, user: User) : one (allowed: Flag)`
- `_canAdd(playlist: Playlist, user: User) : one (allowed: Flag)`
- `_canRemove(playlist: Playlist, user: User) : one (allowed: Flag)`
- `_getMembers(playlist: Playlist) : many (owner: User, member: User, canAdd: Flag, canRemove: Flag)`
- `_getInvites(invitee: User) : many (invite: Invite, playlist: Playlist, inviter: User, invitee: User)`
- `_getSharedPlaylists(user: User) : many (playlist: Playlist)`

#### Instances

- `PlaylistSharing` — instance of `PlaylistSharing` — [Transpose application types](../design/types.md), line 17.
  - `Playlist` is `Playlisting.Playlist` — [Transpose application types](../design/types.md), line 19.
  - `User` is `User` — [Transpose application types](../design/types.md), line 18.

### Playlisting

Defined in [Playlisting](../design/concepts/Playlisting.md), line 1.

#### Actions

- `create(title: String, owner: User) : returns (playlist: Playlist)`
  - Refuses `PLAYLIST_EXISTS`: Playlist already exists.
- `addSong(playlist: Playlist, song: Song, user: User) : returns (song: Song)`
  - Refuses `PLAYLIST_NOT_FOUND`: Playlist not found.
  - Refuses `SONG_IN_PLAYLIST`: Song already exists in the playlist.
- `removeSong(playlist: Playlist, song: Song) : returns (song: Song)`
  - Refuses `PLAYLIST_NOT_FOUND`: Playlist not found.
  - Refuses `SONG_NOT_IN_PLAYLIST`: Song does not exist in the playlist.

#### Queries

- `_getPlaylist(title: String) : one (playlist: Playlist)`
- `_getSongs(playlist: Playlist) : many (song: Song)`
- `_getStoredSong(playlist: Playlist, id: String) : optional (song: Song)`
- `_isOwner(playlist: Playlist, user: User) : one (allowed: Flag)`
- `_getSongsAddedByUser(user: User, playlist: Playlist) : many (song: Song)`

#### Instances

- `Playlisting` — instance of `Playlisting` — [Transpose application types](../design/types.md), line 11.
  - `Song` is `SongRegistering.Song` — [Transpose application types](../design/types.md), line 13.
  - `User` is `User` — [Transpose application types](../design/types.md), line 12.

### SongRegistering

Defined in [SongRegistering](../design/concepts/SongRegistering.md), line 1.

#### Actions

- `register(link: String) : returns (song: Song)`
  - Refuses `BAD_LINK`: That isn't a link to a song we can find.
- `addLink(song: Song, link: String) : returns (song: Song)`
  - Refuses `BAD_LINK`: That isn't a link to a song we can find.
- `unregister(song: Song) : returns (song: Song)`

#### Queries

- `_record(id: String) : optional (song: Song)`
- `_details(song: Song) : optional (platform: Platform, title: String, artist: String, isrc?: String)`
- `_links(song: Song) : many (platform: Platform, songId: String, url: String)`
- `_link(song: Song, platform: Platform) : optional (url: String)`
- `_search(text: String) : many (song: Song, platform: Platform, title: String, artist: String)`

#### Instances

- `SongRegistering` — instance of `SongRegistering` — [Transpose application types](../design/types.md), line 9.

## Application types

Concrete types:

- `User` — [Transpose application types](../design/types.md), line 4.

## Reactions

### DeliverFaultToAsker

```reaction
when any action is faulted, not asked by DeliverFaultToAsker
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respondFramework (error: "INTERNAL_ERROR", requestId)
```

### DeliverRefusalToAsker

```reaction
when any action is refused (message), except RequestBoundary
where
  earlier, RequestBoundary.request (requestId)
then
  RequestBoundary.respond (error: message, requestId)
```

### SharingPlaylists.InitializeSharing

Authored path: `SharingPlaylists.InitializeSharing`.
- Covered by [SharingPlaylists](../design/compositions/SharingPlaylists.md), line 3.

```reaction
when Playlisting.create (owner, playlist)
then
  PlaylistSharing.startSharing (owner, playlist)
```

### Transposing.FindSpotifyLink

Authored path: `Transposing.FindSpotifyLink`.
- Covered by [Transposing](../design/compositions/Transposing.md), line 5.

```reaction
when SongRegistering.register (song)
where
  SongRegistering._details (song) has (artist, platform: "YOUTUBE", title)
  no SongRegistering._link (platform: "SPOTIFY", song)
then
  Matching.find (artist, platform: "SPOTIFY", title)
```

### Transposing.FindSpotifyLink#2

Authored path: `Transposing.FindSpotifyLink`.
- Covered by [Transposing](../design/compositions/Transposing.md), line 5.

```reaction
when Matching.find (artist, platform: "SPOTIFY", title, match), asked by Transposing.FindSpotifyLink
where
  Matching._url (match) has (url)
  earlier, SongRegistering.register (song)
  SongRegistering._details (song) has (artist, platform: "YOUTUBE", title)
then
  SongRegistering.addLink (link: url, song)
```

### Transposing.FindYoutubeLink

Authored path: `Transposing.FindYoutubeLink`.
- Covered by [Transposing](../design/compositions/Transposing.md), line 5.

```reaction
when SongRegistering.register (song)
where
  SongRegistering._details (song) has (artist, platform: "SPOTIFY", title)
  no SongRegistering._link (platform: "YOUTUBE", song)
then
  Matching.find (artist, platform: "YOUTUBE", title)
```

### Transposing.FindYoutubeLink#2

Authored path: `Transposing.FindYoutubeLink`.
- Covered by [Transposing](../design/compositions/Transposing.md), line 5.

```reaction
when Matching.find (artist, platform: "YOUTUBE", title, match), asked by Transposing.FindYoutubeLink
where
  Matching._url (match) has (url)
  earlier, SongRegistering.register (song)
  SongRegistering._details (song) has (artist, platform: "SPOTIFY", title)
then
  SongRegistering.addLink (link: url, song)
```

