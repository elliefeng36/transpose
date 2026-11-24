import assert from "assert";
import { afterAll, beforeAll, beforeEach, describe, it } from "bun:test";
import type { Platform } from "../link-parsing-utils.ts";
import type { Song } from "../concepts/SongRegistering.ts";
import {
  PlaylistingConcept,
  PlaylistExists,
  PlaylistNotFound,
  SongInPlaylist,
  SongNotInPlaylist,
} from "../concepts/Playlisting.ts";
import { openTestDb, type TestDb } from "./test-db.ts";

let testDb: TestDb;
let playlists: PlaylistingConcept;

const songDetails = new Map([
  [
    "SPOTIFY:003vvx7Niy0yvhvHt4a68B",
    { title: "Mr. Brightside", artist: "The Killers", isrc: "USIR20400274" },
  ],
  [
    "SPOTIFY:3ppxTWMGWq7f9tofjNPxiI",
    { title: "Mr. Brightside", artist: "The Killers", isrc: "USIR20400274" },
  ],
  [
    "SPOTIFY:1111111111111111111111",
    { title: "A.M. (Live)", artist: "Someone" },
  ],
  [
    "YOUTUBE:gGdGFtwCNBE",
    {
      title: "The Killers - Mr. Brightside (Official Music Video)",
      artist: "TheKillersVEVO",
    },
  ],
  [
    "YOUTUBE:QVlfINuDdKE",
    {
      title: "The Killers - Mr Brightside | Glastonbury 2019",
      artist: "BBC Music",
    },
  ],
  [
    "YOUTUBE:dQw4w9WgXcQ",
    { title: "Never Gonna Give You Up", artist: "Rick Astley" },
  ],
]);

function makeSong(key: string, _id: string = crypto.randomUUID()): Song {
  const [platform, songId] = key.split(":") as [Platform, string];
  const details = songDetails.get(key)!;
  const song: Song = {
    _id,
    platform,
    title: details.title,
    artist: details.artist,
    default: {
      platform,
      songId,
      url:
        platform === "SPOTIFY"
          ? `https://open.spotify.com/track/${songId}`
          : `https://www.youtube.com/watch?v=${songId}`,
    },
    links: [],
  };
  if (details.isrc !== undefined) {
    song.isrc = details.isrc;
  }
  return song;
}

const BRIGHTSIDE = makeSong("SPOTIFY:003vvx7Niy0yvhvHt4a68B", "song-brightside");
const RICKROLL = makeSong("YOUTUBE:dQw4w9WgXcQ", "song-rickroll");
const AM_LIVE = makeSong("SPOTIFY:1111111111111111111111", "song-am-live");

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
  playlists = new PlaylistingConcept(testDb.db);
});

afterAll(async () => {
  await testDb.close();
});

describe("create", () => {
  it("should create a new playlist with title and owner", async () => {
    const { playlist } = await playlists.create({
      title: "My Roadtrip Playlist",
      owner: "user-1",
    });
    assert(playlist);

    const retrieved = await playlists._getPlaylist({ title: "My Roadtrip Playlist" });
    assert.deepStrictEqual(retrieved, [{ playlist }]);
  });

  it("should refuse if a playlist with the same title already exists", async () => {
    await playlists.create({
      title: "Summer Hits",
      owner: "user-1",
    });

    await assert.rejects(
      async () => {
        await playlists.create({
          title: "Summer Hits",
          owner: "user-2",
        });
      },
      PlaylistExists,
      "Playlist already exists.",
    );
  });
});

describe("addSong", () => {
  it("should add a song to the playlist attributed to the user", async () => {
    const { playlist } = await playlists.create({
      title: "Chill Vibes",
      owner: "user-1",
    });

    const res = await playlists.addSong({
      playlist,
      song: BRIGHTSIDE,
      user: "user-1",
    });
    assert.deepStrictEqual(res.song, BRIGHTSIDE);

    const allSongs = await playlists._getSongs({ playlist });
    assert.deepStrictEqual(allSongs, [{ song: BRIGHTSIDE }]);

    const userSongs = await playlists._getSongsAddedByUser({
      user: "user-1",
      playlist,
    });
    assert.deepStrictEqual(userSongs, [{ song: BRIGHTSIDE }]);
  });

  it("should allow different users to add songs to the playlist", async () => {
    const { playlist } = await playlists.create({
      title: "Party Mix",
      owner: "user-1",
    });

    await playlists.addSong({ playlist, song: BRIGHTSIDE, user: "user-1" });
    await playlists.addSong({ playlist, song: RICKROLL, user: "user-2" });
    await playlists.addSong({ playlist, song: AM_LIVE, user: "user-1" });

    const allSongs = await playlists._getSongs({ playlist });
    assert.deepStrictEqual(allSongs, [
      { song: BRIGHTSIDE },
      { song: RICKROLL },
      { song: AM_LIVE },
    ]);

    const user1Songs = await playlists._getSongsAddedByUser({
      user: "user-1",
      playlist,
    });
    assert.deepStrictEqual(user1Songs, [{ song: BRIGHTSIDE }, { song: AM_LIVE }]);

    const user2Songs = await playlists._getSongsAddedByUser({
      user: "user-2",
      playlist,
    });
    assert.deepStrictEqual(user2Songs, [{ song: RICKROLL }]);
  });

  it("should refuse if playlist does not exist", async () => {
    await assert.rejects(
      async () => {
        await playlists.addSong({
          playlist: "nonexistent-id",
          song: BRIGHTSIDE,
          user: "user-1",
        });
      },
      PlaylistNotFound,
      "Playlist not found.",
    );
  });

  it("should refuse if song is already in the playlist", async () => {
    const { playlist } = await playlists.create({
      title: "Focus",
      owner: "user-1",
    });

    await playlists.addSong({ playlist, song: BRIGHTSIDE, user: "user-1" });

    await assert.rejects(
      async () => {
        await playlists.addSong({
          playlist,
          song: BRIGHTSIDE,
          user: "user-2",
        });
      },
      SongInPlaylist,
      "Song already exists in the playlist.",
    );
  });
});

describe("removeSong", () => {
  it("should remove an existing song from the playlist", async () => {
    const { playlist } = await playlists.create({
      title: "Workout",
      owner: "user-1",
    });

    await playlists.addSong({ playlist, song: BRIGHTSIDE, user: "user-1" });
    await playlists.addSong({ playlist, song: RICKROLL, user: "user-2" });

    const res = await playlists.removeSong({ playlist, song: BRIGHTSIDE });
    assert.deepStrictEqual(res.song, BRIGHTSIDE);

    const allSongs = await playlists._getSongs({ playlist });
    assert.deepStrictEqual(allSongs, [{ song: RICKROLL }]);
  });

  it("should refuse if playlist does not exist", async () => {
    await assert.rejects(
      async () => {
        await playlists.removeSong({
          playlist: "nonexistent-id",
          song: BRIGHTSIDE,
        });
      },
      PlaylistNotFound,
      "Playlist not found.",
    );
  });

  it("should refuse if song is not in the playlist", async () => {
    const { playlist } = await playlists.create({
      title: "Morning Routine",
      owner: "user-1",
    });

    await assert.rejects(
      async () => {
        await playlists.removeSong({
          playlist,
          song: RICKROLL,
        });
      },
      SongNotInPlaylist,
      "Song does not exist in the playlist.",
    );
  });
});

describe("queries", () => {
  it("_getPlaylist should return [] when title does not exist", async () => {
    const res = await playlists._getPlaylist({ title: "Unknown Title" });
    assert.deepStrictEqual(res, []);
  });

  it("_getSongs should return [] when playlist does not exist or has no songs", async () => {
    const notFound = await playlists._getSongs({ playlist: "missing-id" });
    assert.deepStrictEqual(notFound, []);

    const { playlist } = await playlists.create({
      title: "Empty Playlist",
      owner: "user-1",
    });
    const empty = await playlists._getSongs({ playlist });
    assert.deepStrictEqual(empty, []);
  });

  it("_getSongsAddedByUser should return [] when user has not added songs or playlist missing", async () => {
    const missing = await playlists._getSongsAddedByUser({
      user: "user-1",
      playlist: "missing-id",
    });
    assert.deepStrictEqual(missing, []);

    const { playlist } = await playlists.create({
      title: "Collaborative",
      owner: "user-1",
    });
    await playlists.addSong({ playlist, song: BRIGHTSIDE, user: "user-1" });

    const none = await playlists._getSongsAddedByUser({
      user: "user-2",
      playlist,
    });
    assert.deepStrictEqual(none, []);
  });
});
