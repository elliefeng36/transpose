# Sandbox

A local page for trying SongRegistering, Matching, and the Transposing reactions by hand.

```sh
bun run sandbox
```

Then open http://127.0.0.1:3001 (set `SANDBOX_PORT` for another port). Stop it with Ctrl+C.

Sign in or create an account to open the sandbox. Song registration, matching, playlists, and reset all require an active session.

From a playlist you can view, select **Spotify** or **YouTube** and click **Prepare Soundiiz export**. Open the temporary link to review matches and authorize the transfer in Soundiiz. Transpose sends the playlist title and the songs' titles, artists, and ISRCs when available. The export captures the current playlist and later changes require a new export. Soundiiz accepts 1–200 tracks per import link.

In **Playlist sharing**, create two accounts using separate browser profiles or a regular and private window. Sign in as the owner, create a playlist, and invite the other account by username. In the second window, reload and accept the invitation. The new member can add a registered song immediately. The owner can grant removal permission or revoke access. Sharing itself uses no platform API. Accounts and playlists are temporary and are cleared when the sandbox stops.

It runs the application from `src/build.ts` with the real Spotify and YouTube APIs, using the keys in `.env`. The database is an in-memory MongoDB that's thrown away when the server stops, so the sandbox never touches the team's database and doesn't need Docker. The endpoints in `server.ts` belong to the sandbox only, since the app doesn't have its endpoints yet.

## What the page shows

- **Songs**: every song SongRegistering has, with its links and ISRC. Songs with the same title and artist are marked "possible duplicate".
- **Matching**: every search Matching has made, its answer, and whether Matching remembers it, plus any quota pause. **Wrong** tells Matching the answer is the wrong song; it moves on to the next result that search found, without searching again.
- **Activity**: each request and every action it ran. ↳ marks the actions a Transposing reaction asked for.
- **Platform API calls**: each Spotify and YouTube call, and how many YouTube searches have been used.

## Things to try

1. **Duplicates** (see `notes.md`): register "Mr. Brightside · Spotify", then "Mr. Brightside · official video". If Transposing picked a different upload for the first song (usually the "- Topic" audio), you get two songs, and the second song's `addLink` in Activity says the Spotify track already belongs to the first.
2. **Two songs in one request**: put two YouTube links (or two Spotify links) in "Two links in one request". Each song should get its own link from the other platform.
3. **Bad links**: register something that isn't a song link to see the `BAD_LINK` refusal.
4. **Wrong matches**: search with Matching.find, and press Wrong on a bad answer. A song that already got the wrong link keeps it, because SongRegistering can't remove links yet; the page marks it.

## Quota

YouTube allows about 100 searches a day for the whole Google Cloud project, and each new song registered from Spotify uses one. Restarting the sandbox clears what Matching remembers, so registering the same song after a restart searches again. Looking up a YouTube link (oEmbed) is free.
