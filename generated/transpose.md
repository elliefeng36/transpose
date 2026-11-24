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

- `Matching` — instance of `Matching` — [Transpose application types](../design/types.md), line 5.

### SongRegistering

Defined in [SongRegistering](../design/concepts/SongRegistering.md), line 1.

#### Actions

- `register(link: String) : returns (song: Song)`
  - Refuses `BAD_LINK`: That isn't a link to a song we can find.
- `addLink(song: Song, link: String) : returns (song: Song)`
  - Refuses `BAD_LINK`: That isn't a link to a song we can find.
- `unregister(song: Song) : returns (song: Song)`

#### Queries

- `_details(song: Song) : optional (platform: Platform, title: String, artist: String, isrc?: String)`
- `_links(song: Song) : many (platform: Platform, songId: String, url: String)`
- `_link(song: Song, platform: Platform) : optional (url: String)`
- `_search(text: String) : many (song: Song, platform: Platform, title: String, artist: String)`

#### Instances

- `SongRegistering` — instance of `SongRegistering` — [Transpose application types](../design/types.md), line 4.

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

