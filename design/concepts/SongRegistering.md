# SongRegistering

## Purpose

Keep one record of every song users bring into the app, with its link on each platform, so a song is known once and can be opened on whichever platform a listener prefers.

## Principle

A user pastes a Spotify or YouTube link. The song is registered with the title and artist the platform reports, that link, and, when the other platform has a match, a link there too. Pasting a link to the same song again, on either platform, returns the same song. A link that isn't a song link, or that points to a song the platform doesn't know, is rejected. A user can add another link to a song by hand, for a version the automatic match missed. Anyone can find a song by searching part of its title or artist, and ask for its link on a given platform. Unregistering forgets the song and its links; unregistering again does nothing.

## Types

```types
Platform is SPOTIFY or YOUTUBE
  Which streaming service a link points to.
```

## State

```state
a set of Songs with
  a platform Platform
  a title String
  an artist String
  an optional isrc String
  a default Link
  a links seq of Links
a set of Links with
  a platform Platform
  a songId String
  a url String
  unique platform and songId
Rule: url is the original song URL for platform and songId, built from them rather than copied from what was pasted.
Rule: default is the link the song was registered from, and platform is its platform; links are the song's other links.
```

## Actions

```actions
register (link: String) : returns (song: Song)
  where link is not a Spotify or YouTube song link, or names a song the platform does not know
  then
    refuses BAD_LINK "That isn't a link to a song we can find."
  where link is already one of a song's links
  then
    returns song
  where the song at link has an isrc that a registered song already has
  then
    add a link for it to that song
    returns song
  where the song at link is new
  then
    add a new song with the link's platform, the title, artist, and isrc the platform reports, and that link as its default
    if the other platform can be searched and has a match, add a link for it to links
    returns song

addLink (song: Song, link: String) : returns (song: Song)
  where song is not in Songs
  then
    returns song
  where link is not a Spotify or YouTube song link, or names a song the platform does not know
  then
    refuses BAD_LINK "That isn't a link to a song we can find."
  where link is already one of some song's links
  then
    song is the one that already has the link
    returns song
  where link names a song the platform knows
  then
    add a link for it to song's links
    returns song

unregister (song: Song) : returns (song: Song)
  where song is in Songs
  then
    remove song and its links
    returns song
  where song is not in Songs
  then
    returns song
```

## Queries

```queries
_details (song: Song) : optional (platform: Platform, title: String, artist: String, isrc?: String)
  No row when song is unknown. isrc is absent when no platform reported one.
_links (song: Song) : many (platform: Platform, songId: String, url: String)
  The song's other links in the order they were added; none when song is unknown.
_link (song: Song, platform: Platform) : optional (url: String)
  The default if it is on platform, else the song's first other link on platform, if any.
_search (text: String) : many (song: Song, platform: Platform, title: String, artist: String)
  Songs whose title or artist contains text, case-insensitively, ordered by title. No rows for blank text.
```
