# Playlisting

## Purpose

Store songs, allowing different users to add to and delete songs from them.

## Principle

A user creates a playlist and becomes its owner. Other users, which may or may not include the playlist owner, can then add or remove songs from the playlist freely.

## Types

```types
external User
    The person who makes or edits a playlist.

external Song
    The song being added to the playlist
```

## State

```state
a set of Playlists with
    an owner User
    a title String
    a songs set of Songs

a set of Songs with
    a song Song
    an addedBy User
```

## Actions
```actions
create (title: String, owner: User) : returns (playlist: Playlist)
    where a playlist already exists with this title
    then
        refuses PLAYLIST_EXISTS "Playlist already exists."
    where a playlist does not already exist with this title
    then
        create a playlist with this title, assigned to this User
        returns playlist

addSong(playlist: Playlist, song: Song, user: User): returns (song: Song)
    where this playlist does not exist
    then
        refuses PLAYLIST_NOT_FOUND "Playlist not found."
    where song already exists in this playlist
    then
        refuses SONG_IN_PLAYLIST "Song already exists in the playlist."
    where this song does not already exist in this playlist
    then
        add this song to the Playlist, assigned to this User
        returns song

removeSong(playlist: Playlist, song: Song): returns (song: Song)
    where this playlist does not exist
    then
        refuses PLAYLIST_NOT_FOUND "Playlist not found."
    where song does not exist in the playlist
    then
        refuses SONG_NOT_IN_PLAYLIST "Song does not exist in the playlist."
    where this song exists in this playlist
    then
        remove this song from the playlist
        returns song
```

## Queries

```queries
_getPlaylist(title: String): one (playlist : Playlist)
    The playlist corresponding to this title; none when it does not exist.

_getSongs(playlist: Playlist) : many (song : Song)

_getSongsAddedByUser(user: User, playlist: Playlist) : many (song: Song)
    The set of songs in the playlist added by this user. No rows when there are none.
```