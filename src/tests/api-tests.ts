/**
 * 1. search spotify by song title, store the id, isrc, name, artist
 * 2. find the youtube counterpart by name + artist
 * 3. repeat for a second song and build a playlist (just an array)
 * 4. export without anyone signing in to our app:
 *    - youtube: create an anonymous playlist url built from the video ids
 *    - spotify/youtube music: use a soundiiz import link; the user connects their account on soundiiz's
 *      site, which lets us get around the spotify 5-user quota
 */

const SPOTIFY_CLIENT_ID = process.env["SPOTIFY_CLIENT_ID"];
const SPOTIFY_CLIENT_SECRET = process.env["SPOTIFY_CLIENT_SECRET"];
const YOUTUBE_API_KEY = process.env["YOUTUBE_API_KEY"];

const QUERIES = ["mr brightside", "all too well"];

type Song = {
  name: string;
  artist: string;
  isrc: string | undefined;
  spotifyId: string;
  youtubeId: string | undefined;
  youtubeTitle: string | undefined;
};

async function getSpotifyAppToken(): Promise<string> {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = await response.json();
  return body.access_token;
}

async function callSpotify(token: string, path: string) {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

async function searchSpotify(
  token: string,
  text: string,
): Promise<Array<Song>> {
  const body = await callSpotify(
    token,
    `/search?type=track&limit=10&market=US&q=${encodeURIComponent(text)}`,
  );
  const seen = new Set<string>();
  const songs: Array<Song> = [];
  for (const t of body.tracks.items) {
    const key = t.external_ids.isrc;
    if (seen.has(key)) continue;
    seen.add(key);
    songs.push({
      name: t.name,
      artist: t.artists.map((a: { name: string }) => a.name).join(", "),
      isrc: t.external_ids.isrc,
      spotifyId: t.id,
      youtubeId: undefined,
      youtubeTitle: undefined,
    });
  }
  return songs;
}

async function callYoutube(path: string) {
  if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY is required.");
  const url = new URL(`https://www.googleapis.com/youtube/v3${path}`);
  url.searchParams.set("key", YOUTUBE_API_KEY);
  const response = await fetch(url);
  return response.json();
}

async function matchYoutube(song: Song) {
  const q = `${song.name} ${song.artist}`;
  const search = await callYoutube(
    `/search?part=snippet&type=video&videoCategoryId=10&maxResults=5&q=${encodeURIComponent(q)}`,
  );
  for (const v of search.items) {
    console.log(
      `${v.id.videoId}  ${v.snippet.channelTitle}  |  ${v.snippet.title}`,
    );
  }
  return search.items[0];
}

function buildYoutubePlaylistUrl(playlist: Array<Song>): string {
  const ids = playlist.map((s) => s.youtubeId).filter((id) => id !== undefined);
  return `https://www.youtube.com/watch_videos?video_ids=${ids.join(",")}`;
}

async function createSoundiizImportLink(
  playlist: Array<Song>,
  destination: string,
): Promise<string> {
  const response = await fetch("https://soundiiz.com/go/import-playlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Transpose playlist",
      destination,
      tracklist: playlist.map((s) => ({
        title: s.name,
        artists: s.artist.split(", "),
        isrc: s.isrc,
      })),
    }),
  });
  const body = await response.json();
  return body.shareUrl;
}

const appToken = await getSpotifyAppToken();
const playlist: Array<Song> = [];

for (const query of QUERIES) {
  const results = await searchSpotify(appToken, query);
  console.log(`\nspotify results for "${query}"`);
  for (const r of results.slice(0, 5)) {
    console.log(`${r.spotifyId}  ${r.isrc}  ${r.name} — ${r.artist}`);
  }
  const song = results[0];

  console.log(`\nyoutube results for "${song.name}"`);
  const match = await matchYoutube(song);
  song.youtubeId = match.id.videoId;
  song.youtubeTitle = match.snippet.title;
  playlist.push(song);
}

console.log("\nplaylist");
console.log(
  playlist.map((s) => ({
    name: s.name,
    artist: s.artist,
    isrc: s.isrc,
    spotify: s.spotifyId,
    youtube: s.youtubeId,
  })),
);

console.log("\nexport links");
const links = {
  youtube: buildYoutubePlaylistUrl(playlist),
  spotifyViaSoundiiz: await createSoundiizImportLink(playlist, "spotify"),
  youtubeMusicViaSoundiiz: await createSoundiizImportLink(playlist, "ytmusic"),
};
console.log(links);

// test if a remix get its own isrc, or share the original's
console.log("\nisrc: original vs remix");
const original = (
  await searchSpotify(appToken, "mr brightside the killers")
)[0];
const remix = (await searchSpotify(appToken, "mr brightside remix"))[0];
console.log(`${original.isrc}  ${original.name} — ${original.artist}`);
console.log(`${remix.isrc}  ${remix.name} — ${remix.artist}`);
console.log(original.isrc === remix.isrc ? "same isrc" : "different isrc");
