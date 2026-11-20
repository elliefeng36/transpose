export type Platform = "SPOTIFY" | "YOUTUBE";

export type SongRef = { platform: Platform; songId: string };

const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);

export function parseSongLink(link: string): SongRef | null {
  const text = link.trim();

  // spotify:track:<id>
  const uri = /^spotify:track:([A-Za-z0-9]+)$/.exec(text);
  if (uri !== null) {
    const id = uri[1];
    if (SPOTIFY_ID.test(id)) {
      return { platform: "SPOTIFY", songId: id };
    } else {
      return null;
    }
  }

  let url: URL;
  try {
    if (/^[a-z]+:\/\//i.test(text)) {
      url = new URL(text);
    } else {
      url = new URL(`https://${text}`);
    }
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();

  // open.spotify.com/track/<id>
  if (host === "open.spotify.com") {
    const match = /^\/(?:intl-[a-z]+\/)?track\/([A-Za-z0-9]+)$/.exec(
      url.pathname,
    );
    if (match === null) {
      return null;
    }
    const id = match[1];
    if (SPOTIFY_ID.test(id)) {
      return { platform: "SPOTIFY", songId: id };
    } else {
      return null;
    }
  }

  // youtube.com/watch?v=<id> or youtu.be/<id>
  let id: string | null;
  if (YOUTUBE_HOSTS.has(host) && url.pathname === "/watch") {
    id = url.searchParams.get("v");
  } else if (host === "youtu.be") {
    id = url.pathname.slice(1);
  } else {
    return null;
  }
  if (id !== null && YOUTUBE_ID.test(id)) {
    return { platform: "YOUTUBE", songId: id };
  } else {
    return null;
  }
}

export function originalLink(platform: Platform, songId: string): string {
  if (platform === "SPOTIFY") {
    return `https://open.spotify.com/track/${songId}`;
  } else {
    return `https://www.youtube.com/watch?v=${songId}`;
  }
}
