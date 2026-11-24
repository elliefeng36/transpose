import type { Playlist } from "../concepts/Playlisting.ts";

type ExportOptions = {
  loadPlaylist(id: string, user: string): Promise<Pick<Playlist, "title" | "songs"> | null>;
  requestImport?: (url: string, init: RequestInit) => Promise<Response>;
};

const endpoint = "https://soundiiz.com/go/import-playlist";
const maxTracks = 200;
const headers = { "Cache-Control": "no-store" };

function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers });
}

export async function exportPlaylist(input: unknown, user: string, {
  loadPlaylist,
  requestImport = fetch,
}: ExportOptions) {
  if (!input || typeof input !== "object" || !("playlist" in input) || !("destination" in input) ||
      typeof input.playlist !== "string" || !input.playlist.trim() || input.playlist.length > 200 ||
      (input.destination !== "spotify" && input.destination !== "youtube")) {
    return error("Choose a playlist and an export destination.", 400);
  }

  const playlist = await loadPlaylist(input.playlist, user);
  if (!playlist) return error("Playlist not found or unavailable.", 404);
  if (!playlist.songs.length) return error("Add at least one song before exporting.", 400);
  if (playlist.songs.length > maxTracks) return error("Soundiiz supports up to 200 songs per export.", 400);

  const tracklist = playlist.songs.map(({ song }) => ({
    title: song.title,
    artists: song.artist,
    isrc: song.isrc,
  }));

  try {
    const response = await requestImport(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({ title: playlist.title, sourceName: "Transpose", destination: input.destination, tracklist }),
    });
    if (response.status === 429) return error("Soundiiz is rate limiting exports. Try again later.", 503);
    if (!response.ok) return error("Soundiiz could not prepare the export. Try again later.", 502);
    const result = await response.json();
    if (result?.status !== "success" || typeof result.shareUrl !== "string") {
      return error("Soundiiz returned an invalid import link.", 502);
    }
    const link = URL.parse(result.shareUrl);
    if (!link || link.origin !== "https://soundiiz.com" || link.username || link.password ||
        !/^\/go\/import-playlist\/[^/]+$/.test(link.pathname)) {
      return error("Soundiiz returned an invalid import link.", 502);
    }
    return Response.json({ shareUrl: link.href }, { headers });
  } catch (cause) {
    if (cause instanceof Error && cause.name === "TimeoutError") {
      return error("Soundiiz took too long to respond. Try again.", 504);
    }
    return error("Could not reach Soundiiz or read its response. Try again later.", 502);
  }
}
