// The Spotify and YouTube calls, lifted from src/tests/api-tests.ts.
import { RateLimited } from "./concepts/Matching.ts";
import { originalLink, type Platform } from "./link-parsing-utils.ts";

const SPOTIFY_CLIENT_ID = process.env["SPOTIFY_CLIENT_ID"] ?? "";
const SPOTIFY_CLIENT_SECRET = process.env["SPOTIFY_CLIENT_SECRET"] ?? "";
const YOUTUBE_API_KEY = process.env["YOUTUBE_API_KEY"] ?? "";

export type SongDetails = { title: string; artist: string; isrc?: string };

// ---- spotify ----

let spotifyToken: { value: string; expiresAt: number } | null = null;

async function getSpotifyAppToken(): Promise<string> {
  if (spotifyToken !== null && Date.now() < spotifyToken.expiresAt) {
    return spotifyToken.value;
  }
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error(`Spotify token: ${response.status}`);
  const body = await response.json();
  // refresh a minute early so a token never expires mid-request
  spotifyToken = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in - 60) * 1000,
  };
  return spotifyToken.value;
}

async function callSpotify(path: string) {
  const token = await getSpotifyAppToken();
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 429) {
    // Spotify says how long to wait, in seconds
    const seconds = Number(response.headers.get("Retry-After") ?? "30");
    throw new RateLimited("SPOTIFY", new Date(Date.now() + seconds * 1000));
  }
  return response;
}

// ---- youtube ----

async function callYoutube(path: string, params: Record<string, string>) {
  const url = new URL(`https://www.googleapis.com/youtube/v3${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("key", YOUTUBE_API_KEY);
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const reason = body?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
      throw new RateLimited("YOUTUBE", nextPacificMidnight(new Date()));
    }
    throw new Error(`YouTube ${path}: ${response.status} ${reason ?? ""}`);
  }
  return response.json();
}

// YouTube's daily quota resets at midnight Pacific time.
// (Can be off by an hour on the two DST-change days, which is fine for a pause.)
export function nextPacificMidnight(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hourCycle: "h23",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const elapsed = part("hour") * 3600 + part("minute") * 60 + part("second");
  return new Date(now.getTime() + (86400 - elapsed) * 1000);
}

// "Katy Perry - Roar (Official Video)" on "KatyPerryVEVO" -> "Roar" by "Katy Perry"
export function cleanYoutubeDetails(videoTitle: string, channel: string): SongDetails {
  let artist = channel.replace(/ - Topic$/, "").replace(/VEVO$/i, "").trim();
  let title = videoTitle;
  const dash = /^(.+?)\s+[-–—]\s+(.+)$/.exec(title);
  if (dash !== null) {
    artist = dash[1].trim();
    title = dash[2];
  }
  title = title
    .replace(/\s*[([][^)\]]*(official|video|audio|lyric|visuali[sz]er|hd|4k|mv)[^)\]]*[)\]]/gi, "")
    .replace(/\s*\|.*$/, "")
    .trim();
  return { title, artist };
}

// oEmbed needs no API key and uses no quota. It answers 404 for a removed video and 400 for
// an id that can't exist. Whatever else it can't describe (embedding disabled, a private
// video, an ended live stream, a hiccup) goes to videos.list, which costs 1 unit.
async function lookupYoutubeVideo(videoId: string): Promise<SongDetails | null> {
  const url = new URL("https://www.youtube.com/oembed");
  url.searchParams.set("url", originalLink("YOUTUBE", videoId));
  url.searchParams.set("format", "json");
  const response = await fetch(url);
  if (response.ok) {
    const body = await response.json();
    if (typeof body.title === "string" && typeof body.author_name === "string") {
      return cleanYoutubeDetails(body.title, body.author_name);
    }
  } else if (response.status === 400 || response.status === 404) {
    return null; // no such video
  }
  const body = await callYoutube("/videos", { part: "snippet", id: videoId });
  const video = body.items?.[0];
  if (video === undefined) return null;
  return cleanYoutubeDetails(video.snippet.title, video.snippet.channelTitle);
}

// ---- what the concepts call ----

/** SongRegistering's lookup: details for a song id, or null when the platform doesn't have it. */
export async function lookupSong(platform: Platform, songId: string): Promise<SongDetails | null> {
  if (platform === "SPOTIFY") {
    const response = await callSpotify(`/tracks/${songId}`);
    if (response.status === 404 || response.status === 400) return null;
    if (!response.ok) throw new Error(`Spotify track: ${response.status}`);
    const t = await response.json();
    const details: SongDetails = {
      title: t.name,
      artist: t.artists.map((a: { name: string }) => a.name).join(", "),
    };
    if (t.external_ids?.isrc) details.isrc = t.external_ids.isrc;
    return details;
  } else {
    return lookupYoutubeVideo(songId);
  }
}

/** Matching's search: the ids on platform that fit title and artist, best first. Throws on API failure. */
export async function searchSong(
  platform: Platform,
  title: string,
  artist: string,
): Promise<string[]> {
  if (platform === "SPOTIFY") {
    const q = `track:${title} artist:${artist.split(", ")[0]}`;
    const response = await callSpotify(
      `/search?type=track&limit=5&market=US&q=${encodeURIComponent(q)}`,
    );
    if (!response.ok) throw new Error(`Spotify search: ${response.status}`);
    const body = await response.json();
    return body.tracks.items.map((track: { id: string }) => track.id);
  } else {
    // YouTube allows about 100 searches a day; Matching remembers answers so this runs once per song
    const body = await callYoutube("/search", {
      part: "snippet",
      type: "video",
      videoCategoryId: "10",
      maxResults: "5",
      q: `${title} ${artist}`,
    });
    const items: Array<{ id: { videoId: string }; snippet: { channelTitle: string } }> =
      body.items ?? [];
    // The artist's own uploads come first: "<Artist> - Topic" is the exact recording and
    // "<Artist>VEVO" the official video. Everything else keeps YouTube's order (the sort is
    // stable), including other artists' Topic and VEVO uploads.
    const rank = (channel: string) => {
      if (channel.endsWith(" - Topic") && sameArtist(channel.slice(0, -" - Topic".length), artist)) return 0;
      if (/VEVO$/i.test(channel) && sameArtist(channel.slice(0, -"VEVO".length), artist)) return 1;
      return 2;
    };
    return items
      .toSorted((a, b) => rank(a.snippet.channelTitle) - rank(b.snippet.channelTitle))
      .map((video) => video.id.videoId);
  }
}

// "TheKillers" is the same artist as "The Killers". When there are several artists, the first counts.
function sameArtist(channel: string, artist: string): boolean {
  const key = (name: string) => name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const first = key(artist.split(", ")[0] ?? "");
  return first !== "" && key(channel) === first;
}
