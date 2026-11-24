import assert from "assert";
import { afterAll, beforeAll, beforeEach, describe, it } from "bun:test";
import { MatchingConcept } from "../concepts/Matching.ts";
import { openTestDb, type TestDb } from "./test-db.ts";

// what YouTube found for "Until Love Overflows" by s**t kingz, best first
const ROSES = "gWju37TZfo0"; // Outkast's "Roses", on OutkastVEVO
const TV_CLIP = "5N-adb030jI"; // s**t kingz dancing to a different song on a TV show
const TOPIC = "6-jF5O0FGlg"; // "Until Love Overflows", on s**t kingz - Topic
const UNTIL_LOVE_OVERFLOWS = {
  platform: "YOUTUBE",
  title: "Until Love Overflows",
  artist: "s**t kingz",
} as const;
const url = (id: string) => [{ url: `https://www.youtube.com/watch?v=${id}` }];

let testDb: TestDb;
let matching: MatchingConcept;
let searches = 0;

beforeAll(async () => {
  testDb = await openTestDb();
}, 120_000);

beforeEach(async () => {
  await testDb.db.dropDatabase();
  searches = 0;
  matching = new MatchingConcept(testDb.db, async () => {
    searches++;
    return [ROSES, TV_CLIP, TOPIC];
  });
});

afterAll(async () => {
  await testDb.close();
});

describe("Matching", () => {
  it("answers the first song the search found", async () => {
    const { match } = await matching.find(UNTIL_LOVE_OVERFLOWS);
    assert.deepStrictEqual(await matching._url({ match }), url(ROSES));
  });

  it("moves on to the next song when the answer is rejected, without searching again", async () => {
    const { match } = await matching.find(UNTIL_LOVE_OVERFLOWS);
    await matching.reject({ match, songId: ROSES });
    assert.deepStrictEqual(await matching._url({ match }), url(TV_CLIP));
    await matching.reject({ match, songId: TV_CLIP });
    assert.deepStrictEqual(await matching._url({ match }), url(TOPIC));
    assert.strictEqual(searches, 1);
  });

  it("gives the corrected answer to later finds", async () => {
    const { match } = await matching.find(UNTIL_LOVE_OVERFLOWS);
    await matching.reject({ match, songId: ROSES });
    const again = await matching.find(UNTIL_LOVE_OVERFLOWS);
    assert.strictEqual(again.match, match);
    assert.deepStrictEqual(await matching._url({ match }), url(TV_CLIP));
    assert.strictEqual(searches, 1);
  });

  it("has no answer once every song is rejected, and still doesn't search again", async () => {
    const { match } = await matching.find(UNTIL_LOVE_OVERFLOWS);
    for (const songId of [ROSES, TV_CLIP, TOPIC]) {
      await matching.reject({ match, songId });
    }
    assert.deepStrictEqual(await matching._url({ match }), []);
    await matching.find(UNTIL_LOVE_OVERFLOWS);
    assert.strictEqual(searches, 1);
  });

  it("doesn't skip the new answer when the old one is rejected twice", async () => {
    // a double click, or two people rejecting the same video
    const { match } = await matching.find(UNTIL_LOVE_OVERFLOWS);
    await matching.reject({ match, songId: ROSES });
    await matching.reject({ match, songId: ROSES });
    assert.deepStrictEqual(await matching._url({ match }), url(TV_CLIP));
  });

  it("never answers a rejected song, even one that wasn't the answer yet", async () => {
    const { match } = await matching.find(UNTIL_LOVE_OVERFLOWS);
    await matching.reject({ match, songId: TV_CLIP });
    assert.deepStrictEqual(await matching._url({ match }), url(ROSES));
    await matching.reject({ match, songId: ROSES });
    assert.deepStrictEqual(await matching._url({ match }), url(TOPIC));
  });

  it("changes nothing when the match is unknown", async () => {
    assert.deepStrictEqual(await matching.reject({ match: "no-such-match", songId: ROSES }), {
      match: "no-such-match",
    });
  });
});
