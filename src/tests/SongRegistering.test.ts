import assert from "assert";
import { afterAll, beforeAll, beforeEach, describe, it } from "bun:test";
import {
  BadLink,
  SongRegisteringConcept,
} from "../concepts/SongRegistering.ts";
import type { Platform } from "../link-parsing-utils.ts";
import { openTestDb, type TestDb } from "./test-db.ts";

const BRIGHTSIDE_SPOTIFY =
  "https://open.spotify.com/track/003vvx7Niy0yvhvHt4a68B";
const BRIGHTSIDE_YOUTUBE = "https://www.youtube.com/watch?v=gGdGFtwCNBE";
const BRIGHTSIDE_LIVE = "https://www.youtube.com/watch?v=QVlfINuDdKE";
const RICKROLL = "https://youtu.be/dQw4w9WgXcQ";

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
const counterparts = new Map([
  ["YOUTUBE:Mr. Brightside", "gGdGFtwCNBE"],
  ["SPOTIFY:Never Gonna Give You Up", "4cOdK2wGLETKBW3PvgPWqT"],
]);
let lookups = 0;
const lookupFromTable = async (platform: Platform, songId: string) => {
  lookups++;
  const details = songDetails.get(`${platform}:${songId}`);
  if (details === undefined) {
    return null;
  } else {
    return details;
  }
};
const matchFromTable = async (platform: Platform, title: string) => {
  const id = counterparts.get(`${platform}:${title}`);
  if (id === undefined) {
    return null;
  } else {
    return id;
  }
};
let lookupSong = lookupFromTable;
let matchSong = matchFromTable;

let testDb: TestDb;
let songs: SongRegisteringConcept;

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
  lookups = 0;
  lookupSong = lookupFromTable;
  matchSong = matchFromTable;
  songs = new SongRegisteringConcept(
    testDb.db,
    (platform, songId) => lookupSong(platform, songId),
    (platform, title) => matchSong(platform, title),
  );
});

afterAll(async () => {
  await testDb.close();
});

describe("register", () => {
  it("should record the title, artist, isrc, and platform of a spotify link", async () => {
    const { song } = await songs.register({
      link: `${BRIGHTSIDE_SPOTIFY}?si=x`,
    });
    assert.deepStrictEqual(await songs._details({ song }), [
      {
        platform: "SPOTIFY",
        title: "Mr. Brightside",
        artist: "The Killers",
        isrc: "USIR20400274",
      },
    ]);
  });

  it("should record a youtube link with no isrc", async () => {
    const { song } = await songs.register({ link: RICKROLL });
    assert.deepStrictEqual(await songs._details({ song }), [
      {
        platform: "YOUTUBE",
        title: "Never Gonna Give You Up",
        artist: "Rick Astley",
      },
    ]);
  });

  it("should find the youtube counterpart of a spotify link", async () => {
    const { song } = await songs.register({ link: BRIGHTSIDE_SPOTIFY });
    assert.deepStrictEqual(await songs._links({ song }), [
      { platform: "YOUTUBE", songId: "gGdGFtwCNBE", url: BRIGHTSIDE_YOUTUBE },
    ]);
  });

  it("should find the spotify counterpart of a youtube link", async () => {
    const { song } = await songs.register({ link: RICKROLL });
    assert.deepStrictEqual(await songs._links({ song }), [
      {
        platform: "SPOTIFY",
        songId: "4cOdK2wGLETKBW3PvgPWqT",
        url: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
      },
    ]);
  });

  it("should keep only its own link when the other platform has no match", async () => {
    matchSong = async () => null;
    const { song } = await songs.register({ link: BRIGHTSIDE_SPOTIFY });
    assert.deepStrictEqual(await songs._links({ song }), []);
  });

  it("should still register when searching the other platform fails", async () => {
    matchSong = async () => {
      throw new Error("quota exceeded");
    };
    const { song } = await songs.register({ link: BRIGHTSIDE_SPOTIFY });
    assert.deepStrictEqual(await songs._links({ song }), []);
  });

  it("should return the same song for another form of its default link, without asking the platform again", async () => {
    const first = await songs.register({
      link: "spotify:track:003vvx7Niy0yvhvHt4a68B",
    });
    const again = await songs.register({
      link: "https://open.spotify.com/intl-fr/track/003vvx7Niy0yvhvHt4a68B",
    });
    assert.deepStrictEqual(again, first);
    assert.strictEqual(lookups, 1);
  });

  it("should return the same song for one of its other links", async () => {
    const first = await songs.register({ link: BRIGHTSIDE_SPOTIFY });
    const viaYoutube = await songs.register({
      link: "https://youtu.be/gGdGFtwCNBE",
    });
    assert.deepStrictEqual(viaYoutube, first);
    assert.strictEqual(
      await testDb.db.collection("songRegistering.songs").countDocuments(),
      1,
    );
  });

  it("should attach another release with the same isrc to the existing song", async () => {
    const first = await songs.register({ link: BRIGHTSIDE_SPOTIFY });
    const second = await songs.register({
      link: "https://open.spotify.com/track/3ppxTWMGWq7f9tofjNPxiI",
    });
    assert.deepStrictEqual(second, first);
    const links = await songs._links({ song: first.song });
    assert.deepStrictEqual(
      links.map((l) => l.songId),
      ["gGdGFtwCNBE", "3ppxTWMGWq7f9tofjNPxiI"],
    );
  });

  it("should reject a link that isn't a song link, without calling the platform", async () => {
    for (const link of [
      "https://open.spotify.com/album/1ATL5GLyefJaxhQzSPVrLX",
      "https://www.youtube.com/playlist?list=PL123",
      "garbage",
    ]) {
      await assert.rejects(songs.register({ link }), BadLink, link);
    }
    assert.strictEqual(lookups, 0);
  });

  it("should reject a link to a song the platform doesn't know", async () => {
    await assert.rejects(
      songs.register({
        link: "https://open.spotify.com/track/0000000000000000000000",
      }),
      BadLink,
    );
    assert.strictEqual(
      await testDb.db.collection("songRegistering.songs").countDocuments(),
      0,
    );
  });

  it("should let a platform lookup failure through as a plain error", async () => {
    lookupSong = async () => {
      throw new Error("Spotify is down");
    };
    await assert.rejects(songs.register({ link: BRIGHTSIDE_SPOTIFY }), {
      message: "Spotify is down",
    });
  });
});

describe("addLink", () => {
  it("should add a link to the song", async () => {
    const { song } = await songs.register({ link: BRIGHTSIDE_SPOTIFY });
    assert.deepStrictEqual(
      await songs.addLink({ song, link: BRIGHTSIDE_LIVE }),
      { song },
    );
    assert.deepStrictEqual(
      (await songs._links({ song })).map((l) => l.songId),
      ["gGdGFtwCNBE", "QVlfINuDdKE"],
    );
  });

  it("should not add a link the song already has", async () => {
    const { song } = await songs.register({ link: BRIGHTSIDE_SPOTIFY });
    await songs.addLink({ song, link: BRIGHTSIDE_LIVE });
    assert.deepStrictEqual(
      await songs.addLink({ song, link: BRIGHTSIDE_LIVE }),
      { song },
    );
    assert.strictEqual((await songs._links({ song })).length, 2);
  });

  it("should answer the song that already has the link, and leave this one alone", async () => {
    const { song } = await songs.register({ link: BRIGHTSIDE_SPOTIFY });
    const other = await songs.register({ link: RICKROLL });
    assert.deepStrictEqual(
      await songs.addLink({ song: other.song, link: BRIGHTSIDE_YOUTUBE }),
      { song },
    );
    assert.strictEqual((await songs._links({ song: other.song })).length, 1);
  });

  it("should do nothing for an unknown song", async () => {
    assert.deepStrictEqual(
      await songs.addLink({ song: "nope", link: BRIGHTSIDE_LIVE }),
      { song: "nope" },
    );
  });

  it("should reject a link that isn't a song link", async () => {
    const { song } = await songs.register({ link: BRIGHTSIDE_SPOTIFY });
    await assert.rejects(songs.addLink({ song, link: "garbage" }), BadLink);
  });

  it("should reject a link to a song the platform doesn't know", async () => {
    const { song } = await songs.register({ link: BRIGHTSIDE_SPOTIFY });
    await assert.rejects(
      songs.addLink({ song, link: "https://youtu.be/00000000000" }),
      BadLink,
    );
  });
});

describe("unregister", () => {
  it("should forget the song", async () => {
    const { song } = await songs.register({ link: BRIGHTSIDE_SPOTIFY });
    assert.deepStrictEqual(await songs.unregister({ song }), { song });
    assert.deepStrictEqual(await songs._details({ song }), []);
  });

  it("should do nothing for an unknown song", async () => {
    assert.deepStrictEqual(await songs.unregister({ song: "nope" }), {
      song: "nope",
    });
  });
});

describe("_link", () => {
  it("should answer the default when it is on that platform", async () => {
    const { song } = await songs.register({ link: BRIGHTSIDE_SPOTIFY });
    assert.deepStrictEqual(await songs._link({ song, platform: "SPOTIFY" }), [
      { url: BRIGHTSIDE_SPOTIFY },
    ]);
  });

  it("should answer one of the other links when the default is not on that platform", async () => {
    const { song } = await songs.register({ link: BRIGHTSIDE_SPOTIFY });
    assert.deepStrictEqual(await songs._link({ song, platform: "YOUTUBE" }), [
      { url: BRIGHTSIDE_YOUTUBE },
    ]);
  });

  it("should answer nothing when the song has no link on that platform", async () => {
    matchSong = async () => null;
    const { song } = await songs.register({ link: BRIGHTSIDE_SPOTIFY });
    assert.deepStrictEqual(
      await songs._link({ song, platform: "YOUTUBE" }),
      [],
    );
  });
});

describe("_search", () => {
  const searchTitles = async (text: string) =>
    (await songs._search({ text })).map((r) => r.title);

  beforeEach(async () => {
    await songs.register({ link: RICKROLL });
    await songs.register({ link: BRIGHTSIDE_SPOTIFY });
    await songs.register({ link: "spotify:track:1111111111111111111111" });
  });

  it("should match on title", async () => {
    assert.deepStrictEqual(await searchTitles("never gonna"), [
      "Never Gonna Give You Up",
    ]);
  });

  it("should match on artist, ignoring case", async () => {
    assert.deepStrictEqual(await searchTitles("KILLERS"), ["Mr. Brightside"]);
  });

  it("should order matches by title", async () => {
    assert.deepStrictEqual(await searchTitles("e"), [
      "A.M. (Live)",
      "Mr. Brightside",
      "Never Gonna Give You Up",
    ]);
  });

  it("should answer song, platform, title, and artist", async () => {
    const [row] = await songs._search({ text: "killers" });
    assert.deepStrictEqual(Object.keys(row).sort(), [
      "artist",
      "platform",
      "song",
      "title",
    ]);
    assert.strictEqual(row.platform, "SPOTIFY");
  });

  it("should treat regex characters literally", async () => {
    assert.deepStrictEqual(await searchTitles("A.M. (Live)"), ["A.M. (Live)"]);
    assert.deepStrictEqual(await searchTitles(".*"), []);
  });

  it("should answer nothing for blank text", async () => {
    assert.deepStrictEqual(await searchTitles(""), []);
    assert.deepStrictEqual(await searchTitles("   "), []);
  });
});

describe("queries on an unknown song", () => {
  it("should answer no rows", async () => {
    assert.deepStrictEqual(await songs._details({ song: "nope" }), []);
    assert.deepStrictEqual(await songs._links({ song: "nope" }), []);
    assert.deepStrictEqual(
      await songs._link({ song: "nope", platform: "SPOTIFY" }),
      [],
    );
  });
});
