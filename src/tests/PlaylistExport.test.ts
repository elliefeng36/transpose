import { expect, test } from "bun:test";
import type { Playlist } from "../concepts/Playlisting.ts";
import { exportPlaylist } from "../sandbox/playlist-export.ts";

const shareUrl = "https://soundiiz.com/go/import-playlist/test-link";
const link = { platform: "SPOTIFY", songId: "song", url: "https://open.spotify.com/track/song" } as const;
const playlist: Pick<Playlist, "title" | "songs"> = {
  title: "Road trip",
  songs: [
    {
      addedBy: "alex",
      song: {
        _id: "first", platform: "SPOTIFY", title: "First", artist: "Artist, Jr.",
        isrc: "USIR20400274", default: link, links: [],
      },
    },
    {
      addedBy: "sam",
      song: { _id: "second", platform: "SPOTIFY", title: "Second", artist: "Another Artist", default: link, links: [] },
    },
  ],
};
const input = { playlist: "playlist-id", destination: "spotify" };
const loadPlaylist = async () => playlist;

for (const destination of ["spotify", "youtube"]) {
  test(`exports the ordered tracklist to ${destination}`, async () => {
    const response = await exportPlaylist({ ...input, destination }, "alex", {
      async loadPlaylist(id, user) {
        expect(id).toBe(input.playlist);
        expect(user).toBe("alex");
        return playlist;
      },
      async requestImport(url, init) {
        expect(url).toBe("https://soundiiz.com/go/import-playlist");
        expect(init.method).toBe("POST");
        expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
        expect(JSON.parse(String(init.body))).toEqual({
          title: "Road trip",
          sourceName: "Transpose",
          destination,
          tracklist: [
            { title: "First", artists: "Artist, Jr.", isrc: "USIR20400274" },
            { title: "Second", artists: "Another Artist" },
          ],
        });
        return Response.json({ status: "success", shareUrl });
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ shareUrl });
  });
}

test("unavailable playlists do not send track metadata to Soundiiz", async () => {
  let sent = false;
  const response = await exportPlaylist({ ...input, user: "alex" }, "outsider", {
    async loadPlaylist(_id, user) {
      expect(user).toBe("outsider");
      return null;
    },
    async requestImport() {
      sent = true;
      return new Response();
    },
  });
  expect(response.status).toBe(404);
  expect(sent).toBe(false);
});

test("invalid input, empty playlists and oversized playlists are rejected locally", async () => {
  let loads = 0;
  let sends = 0;
  async function requestImport() {
    sends++;
    return new Response();
  }
  const invalid = await exportPlaylist({ ...input, destination: "ytmusic" }, "alex", {
    async loadPlaylist() { loads++; return playlist; },
    requestImport,
  });
  expect(invalid.status).toBe(400);
  expect(loads).toBe(0);
  for (const count of [0, 201]) {
    const result = await exportPlaylist(input, "alex", {
      loadPlaylist: async () => ({ ...playlist, songs: Array(count).fill(playlist.songs[0]) }),
      requestImport,
    });
    expect(result.status).toBe(400);
  }
  expect(sends).toBe(0);
});

test("provider failures and unsafe response links are rejected", async () => {
  const cases: [() => Promise<Response>, number][] = [
    [async () => new Response(null, { status: 429 }), 503],
    [async () => new Response(null, { status: 500 }), 502],
    [async () => new Response("not JSON"), 502],
    [async () => Response.json({ status: "success", shareUrl: "https://example.org/go/import-playlist/test" }), 502],
    [async () => Response.json({ status: "success", shareUrl: "https://soundiiz.com/other" }), 502],
    [async () => { throw new DOMException("timed out", "TimeoutError"); }, 504],
  ];
  for (const [requestImport, status] of cases) {
    const result = await exportPlaylist(input, "alex", { loadPlaylist, requestImport });
    expect(result.status).toBe(status);
    expect(await result.json()).not.toHaveProperty("shareUrl");
  }
});
