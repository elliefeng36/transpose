# Duplicate songs from different YouTube uploads

Notes for a conversation about SongRegistering. Nov 21, 2026.

## Summary

If a song is already registered and someone pastes a *different* YouTube upload of it (the official video instead of the "- Topic" audio, a lyric video, a live video), we create a second song, and that second song never gets a Spotify link. Fixing this properly takes a change to SongRegistering, so we should agree on the approach first. We prototyped three fixes, each with tests. The proposal is option B: `register` looks up a YouTube link's Spotify match *before* it creates a song, using the `match` parameter SongRegistering already has.

## How it happens

1. Someone adds Mr. Brightside from Spotify, which creates song A. The FindYoutubeLink reaction searches YouTube. Our search prefers "Artist - Topic" uploads, so A's YouTube link becomes the Topic audio.
2. Someone else pastes the official music video. `register` doesn't know that video. It can't match it by ISRC either: YouTube doesn't report ISRCs (oEmbed and the Data API give only a title and a channel), so for a YouTube link the ISRC branch never applies. So `register` creates song B.
3. The FindSpotifyLink reaction searches Spotify for B and finds the track A already has, then calls `addLink(B, track)`. When a link already belongs to another song, `addLink` returns that song and changes nothing ([SongRegistering.ts:100-102](src/concepts/SongRegistering.ts#L100-L102)). So it returns A, and B is left alone.

The result is two songs for one recording. B has no Spotify link, so Spotify listeners can't play it from the playlist it was added to. The same thing happens in the other order (official video first, Topic audio second). It will probably be common, because people usually share official videos while our search picks Topic uploads.

A related gap: a song registered from YouTube never gets an ISRC, because `addLink` doesn't copy the Spotify track's ISRC onto it. So a different Spotify release of the same recording can't join it by ISRC, which is a second way to get duplicates.

## Why the reactions can't fix it alone

"Is this a song we already have?" has to be decided by the action that creates songs. The framework docs say so directly: "A uniqueness, capacity, first-come, or answer-once decision belongs in the action that owns the state. A reaction's `where` is a current observation, not an atomic guard" (semantics.md, "Decisions that must not race"). Once B exists, only a SongRegistering action can fold it into A. The alternative is for `register` not to create B in the first place.

## The options

Each option was built in a scratch copy of the repo, with tests for:
- both paste orders;
- two pastes at the same time;
- different songs staying apart;
- a cover video;
- pasting the same link twice.

All three fix the tested duplicates and pass `sync-engine check`. C breaks one existing SongRegistering test on purpose (see below).

| | A: merge afterwards | B: decide in `register` (proposed) | C: `addLink` merges |
| --- | --- | --- | --- |
| How it works | A reaction merges the new song into the song that owns the matched link | `register` finds a YouTube link's Spotify match before creating a song, and joins the song that already has that track | `addLink(song, link)` merges `song` into the link's owner instead of ignoring it |
| New in SongRegistering | `merge(song, into)` action and `_owner(link)` query | No new actions or queries. `register` gets two more branches, and `build.ts` passes a Spotify-only `match` instead of `noMatch` | `addLink` behaves differently, plus a `_song(link)` query |
| Deletes songs | Yes | No | Yes |
| Song ID the person who pasted gets back | Already deleted. The add-song endpoint has to wait for the reactions and then look the song up again | The surviving song, right away | Already deleted, same as A |
| Missing-ISRC gap | Not fixed | Fixed, except on one fallback path | Not fixed |
| Existing SongRegistering tests | All pass | All pass unchanged | One fails by design |

### B: decide in `register` (proposed)

For a YouTube link, `register` asks `match` for the Spotify track before it creates anything:

- If that track is already one of some song's links, the pasted link joins that song, and `register` returns it.
- Otherwise, if the track's ISRC belongs to a registered song, the pasted link joins that song.
- Otherwise it creates the song with the Spotify link, and records the track's ISRC. This closes the ISRC gap on the normal path.

Spotify links work exactly as they do today. YouTube search stays in Matching, behind its cache and quota pause, because YouTube only allows about 100 searches a day. FindSpotifyLink stays as a fallback for when the Spotify search inside `register` fails or finds nothing.

Proposed spec text for `register`, after the existing ISRC branch:

```
  where the other platform can be searched, and its match for the song at link is already one of a song's links
  then
    add a link for it to that song
    returns song
  where the song at link has no isrc, and the other platform reports an isrc for its match that a registered song already has
  then
    add a link for it to that song
    returns song
  where the song at link is new
  then
    add a new song with the link's platform, the title and artist the platform reports, and that link as its default
    if the other platform can be searched and has a match, add a link for it to links; a failed search counts as no match
    set its isrc to the one the platform reports, or else to the one the other platform reports for the match, if either does
    returns song
```

The spec also gets one new State rule (where the ISRC comes from) and one sentence in the Principle. No signatures change. The code change is about 55 lines in `SongRegistering.ts`.

Why B:
- No song is ever deleted, so song IDs stored in playlists stay valid.
- The add-song endpoint can answer with `register`'s result directly.
- It closes the ISRC gap for most songs.
- It makes the decision in the action that owns the state, as the framework asks, and it uses `match` the way it was designed to be used.

What B costs:
- For YouTube links, `register` now waits on a Spotify search, and sometimes a track lookup. SongRegistering runs one action at a time, so other registrations wait behind it.
- That search isn't cached and doesn't see Matching's rate-limit pause. When it fails, the song is still registered without a Spotify link, and right now the error isn't logged.
- Two rarer duplicates remain:
  - a Spotify release of the song with a *different* ISRC (single vs. album, or a remaster);
  - a YouTube link pasted while Spotify search is failing, whose track turns out to belong to another song when FindSpotifyLink retries.
- The fix depends on `build.ts` passing the Spotify matcher. With `noMatch`, the bug comes back silently.

### A: merge afterwards

SongRegistering gets a `merge(song, into)` action and an `_owner(link)` query. The reactions merge the new song into whichever song owns the matched link.

- By the time the person who pasted gets their song ID back, that song has already been merged away and deleted. The add-song endpoint has to wait for the reactions to finish, then look the song up again by its link. While it waits, any error in the reactions becomes the user's error, even though the song was registered.
- A merge that is delayed, for example by a quota pause, can delete a song that's already in a playlist.
- The obvious reaction shape lost a race. When two uploads of a new song were pasted at the same moment, it made 2 songs in 10 of 10 runs, until the merge was chained onto `addLink`'s answer.
- It doesn't fix the ISRC gap.

### C: `addLink` merges

This is the smallest code change: `addLink` merges instead of returning the owner, and SongRegistering gets a `_song(link)` query.

- It has the same deleted-ID problem as A.
- An accidental manual `addLink` (someone pastes the wrong song's link) would permanently merge two unrelated songs. That's exactly what the existing test "should answer the song that already has the link, and leave this one alone" protects against, and C breaks that test.
- It doesn't fix the ISRC gap.

## Wrong matches, in all three options

Today, a cover video whose Spotify search lands on the original's track just gets the wrong Spotify link. Under any of the three options, it also joins the original song:
- Whoever pasted the cover gets the original song and hears the original.
- If the cover came first, every later upload of the original joins the cover's song.

There's no way to undo a join, because SongRegistering has no `removeLink` or split action.

Our real Spotify query filters by artist, so this should be rarer than the tests make it look; the tests forced the bad match. A cheap guard would be to join only when the matched track's artist agrees with the artist parsed from the upload.

## Questions to decide

1. Is it OK for `register` to use `match` again, for YouTube links only? This partly walks back the Nov 20 split: Spotify search moves into `register`, while YouTube search stays in Matching.
2. Should a join require the artists to agree? If so, what counts as agreeing (first artist only, case-insensitive, ignoring "feat.")?
3. Should `addLink` fill in a missing ISRC? That would close B's fallback path. What should happen if another song already has that ISRC?
4. Do we want a way to undo a wrong join, such as a `removeLink` action? It would also let a wrong video come off a song: Matching can now be told an answer is wrong (`reject`), but a song that already got that video keeps it.
5. Are the two remaining rare duplicates acceptable for the alpha and beta, or do we also want a `merge` action later?
6. Should the Spotify search inside `register` log its errors instead of swallowing them?
7. Should this land before the alpha on Nov 23, or after it?
