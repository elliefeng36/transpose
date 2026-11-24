import assert from "assert";
import { assemble } from "@mit-sdg/sync-engine/assembly";
import { endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { afterAll, beforeAll, beforeEach, describe, it } from "bun:test";
import { composition } from "../compositions/Transposing.ts";
import { MatchingConcept, RateLimited } from "../concepts/Matching.ts";
import { SongRegisteringConcept } from "../concepts/SongRegistering.ts";
import { applicationConceptSet, concepts } from "../concepts.ts";
import type { Platform } from "../link-parsing-utils.ts";
import { openTestDb, type TestDb } from "./test-db.ts";

const BRIGHTSIDE_SPOTIFY = "https://open.spotify.com/track/003vvx7Niy0yvhvHt4a68B";
const BRIGHTSIDE_YOUTUBE = "https://www.youtube.com/watch?v=gGdGFtwCNBE";
const ROAR_SPOTIFY = "https://open.spotify.com/track/6F5c58TMEs1byxUstkzVeM";
const ROAR_YOUTUBE = "https://www.youtube.com/watch?v=CevxZvSJLk8";

const details = new Map([
  ["SPOTIFY:003vvx7Niy0yvhvHt4a68B", { title: "Mr. Brightside", artist: "The Killers", isrc: "USIR20400274" }],
  ["YOUTUBE:gGdGFtwCNBE", { title: "Mr. Brightside", artist: "The Killers" }],
  ["YOUTUBE:CevxZvSJLk8", { title: "Roar", artist: "Katy Perry" }],
  ["SPOTIFY:6F5c58TMEs1byxUstkzVeM", { title: "Roar", artist: "Katy Perry", isrc: "USCA21301180" }],
]);
const searchIndex = new Map([
  ["YOUTUBE:Mr. Brightside:The Killers", "gGdGFtwCNBE"],
  ["SPOTIFY:Mr. Brightside:The Killers", "003vvx7Niy0yvhvHt4a68B"],
  ["YOUTUBE:Roar:Katy Perry", "CevxZvSJLk8"],
  ["SPOTIFY:Roar:Katy Perry", "6F5c58TMEs1byxUstkzVeM"],
]);

// one request that registers two songs
const RegisterTwo = endpoint(
  "/test/register-two",
  ({ first, second, a, b }) =>
    receive({ first, second })
      .then(concepts.SongRegistering.register({ link: first }).responds({ song: a }))
      .then(concepts.SongRegistering.register({ link: second }).responds({ song: b }))
      .then(respond({ a, b })),
  { input: { required: ["first", "second"] } },
);

// what the search finds among the fixtures above: the one id it knows, or nothing
function found(platform: Platform, title: string, artist: string): string[] {
  const id = searchIndex.get(`${platform}:${title}:${artist}`);
  return id === undefined ? [] : [id];
}

let searches = 0;
let search = async (platform: Platform, title: string, artist: string) => {
  searches++;
  return found(platform, title, artist);
};

let clock = new Date("2026-11-21T12:00:00Z");

let testDb: TestDb;
let app: ReturnType<typeof build>;

function build() {
  return assemble({
    conceptSet: applicationConceptSet,
    instances: {
      SongRegistering: new SongRegisteringConcept(
        testDb.db,
        async (platform, songId) => details.get(`${platform}:${songId}`) ?? null,
        async () => null,
      ),
      Matching: new MatchingConcept(
        testDb.db,
        (p, t, a) => search(p, t, a),
        () => clock,
      ),
    },
    composition: { Transposing: composition, Test: { RegisterTwo } },
  });
}

async function register(link: string): Promise<string> {
  const result = await app.concepts.SongRegistering.register({ link });
  await app.whenIdle();
  return (result as { song: string }).song;
}

async function registerTwo(first: string, second: string) {
  const result = await app.invoker.invoke("/test/register-two", { first, second });
  await app.whenIdle();
  assert.ok(result.ok, JSON.stringify(result));
  return result.value as { a: string; b: string };
}

async function link(song: string, platform: Platform) {
  return app.concepts.SongRegistering._link({ song, platform });
}

// every link except the one the song was registered from
async function otherLinks(song: string) {
  const links = await app.concepts.SongRegistering._links({ song });
  return links.map((l) => l.url);
}

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
  searches = 0;
  clock = new Date("2026-11-21T12:00:00Z");
  search = async (platform, title, artist) => {
    searches++;
    return found(platform, title, artist);
  };
  app = build();
});

afterAll(async () => {
  await testDb.close();
});

describe("Transposing", () => {
  it("adds the YouTube link to a song registered from Spotify", async () => {
    const song = await register(BRIGHTSIDE_SPOTIFY);
    assert.deepStrictEqual(await link(song, "YOUTUBE"), [{ url: BRIGHTSIDE_YOUTUBE }]);
  });

  it("adds the Spotify link to a song registered from YouTube", async () => {
    const song = await register(ROAR_YOUTUBE);
    assert.deepStrictEqual(await link(song, "SPOTIFY"), [{ url: ROAR_SPOTIFY }]);
  });

  it("gives each of two songs registered in one request its own Spotify link", async () => {
    const { a, b } = await registerTwo(BRIGHTSIDE_YOUTUBE, ROAR_YOUTUBE);
    assert.deepStrictEqual(await otherLinks(a), [BRIGHTSIDE_SPOTIFY]);
    assert.deepStrictEqual(await otherLinks(b), [ROAR_SPOTIFY]);
  });

  it("gives each of two songs registered in one request its own YouTube link", async () => {
    const { a, b } = await registerTwo(BRIGHTSIDE_SPOTIFY, ROAR_SPOTIFY);
    assert.deepStrictEqual(await otherLinks(a), [BRIGHTSIDE_YOUTUBE]);
    assert.deepStrictEqual(await otherLinks(b), [ROAR_YOUTUBE]);
  });

  it("doesn't search again when the same link is registered twice", async () => {
    const first = await register(BRIGHTSIDE_SPOTIFY);
    const second = await register(BRIGHTSIDE_SPOTIFY);
    assert.strictEqual(first, second);
    assert.strictEqual(searches, 1);
  });

  it("keeps only the song's own link when the other platform has no match", async () => {
    search = async () => {
      searches++;
      return [];
    };
    const song = await register(BRIGHTSIDE_SPOTIFY);
    assert.deepStrictEqual(await link(song, "YOUTUBE"), []);
    assert.deepStrictEqual(await link(song, "SPOTIFY"), [{ url: BRIGHTSIDE_SPOTIFY }]);
  });

  it("still registers the song when the search fails, and retries next time", async () => {
    search = async () => {
      searches++;
      throw new Error("network down");
    };
    const song = await register(BRIGHTSIDE_SPOTIFY);
    assert.deepStrictEqual(await link(song, "YOUTUBE"), []);
    const matching = app.concepts.Matching;
    await matching.find({ platform: "YOUTUBE", title: "Mr. Brightside", artist: "The Killers" });
    assert.strictEqual(searches, 2);
  });

  it("stops searching a platform once its quota runs out, until it resets", async () => {
    search = async () => {
      searches++;
      throw new RateLimited("YOUTUBE", new Date("2026-11-22T08:00:00Z"));
    };
    const song = await register(BRIGHTSIDE_SPOTIFY);
    assert.deepStrictEqual(await link(song, "YOUTUBE"), []);
    assert.strictEqual(searches, 1);

    // more adds while paused: no calls to YouTube at all
    await register(BRIGHTSIDE_SPOTIFY);
    await app.concepts.Matching.find({ platform: "YOUTUBE", title: "Roar", artist: "Katy Perry" });
    assert.strictEqual(searches, 1);

    // after the reset, the next add searches again and gets its link
    clock = new Date("2026-11-22T08:00:01Z");
    search = async (platform, title, artist) => {
      searches++;
      return found(platform, title, artist);
    };
    await register(BRIGHTSIDE_SPOTIFY);
    assert.strictEqual(searches, 2);
    assert.deepStrictEqual(await link(song, "YOUTUBE"), [{ url: BRIGHTSIDE_YOUTUBE }]);
  });
});
