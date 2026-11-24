import assert from "assert";
import { afterEach, describe, it, spyOn } from "bun:test";
import { RateLimited } from "../concepts/Matching.ts";
import { lookupSong, searchSong } from "../platform-apis.ts";

// fetch answers with these responses in order, and records which URLs were asked for
let asked: URL[] = [];
let fetchSpy: { mockRestore(): void } | undefined;
function answer(...responses: Response[]) {
  fetchSpy?.mockRestore();
  asked = [];
  const fakeFetch = async (input: string | URL | Request) => {
    asked.push(new URL(input instanceof Request ? input.url : String(input)));
    const next = responses.shift();
    if (next === undefined) throw new Error(`unexpected fetch of ${input}`);
    return next;
  };
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation(fakeFetch as typeof fetch);
}

const json = (status: number, body: unknown) => Response.json(body, { status });
const text = (status: number) => new Response("", { status });
const where = (url: URL) => url.origin + url.pathname;

afterEach(() => {
  fetchSpy?.mockRestore();
  fetchSpy = undefined;
});

describe("lookupSong on YouTube", () => {
  it("reads the title and channel from oEmbed, without the API key", async () => {
    answer(
      json(200, {
        title: "The Killers - Mr. Brightside (Official Music Video)",
        author_name: "TheKillersVEVO",
      }),
    );
    assert.deepStrictEqual(await lookupSong("YOUTUBE", "gGdGFtwCNBE"), {
      title: "Mr. Brightside",
      artist: "The Killers",
    });
    assert.strictEqual(asked.length, 1);
    const [url] = asked;
    assert.strictEqual(where(url!), "https://www.youtube.com/oembed");
    assert.strictEqual(url!.searchParams.get("url"), "https://www.youtube.com/watch?v=gGdGFtwCNBE");
    assert.strictEqual(url!.searchParams.get("format"), "json");
    assert.strictEqual(url!.searchParams.has("key"), false);
  });

  it("takes the artist from a Topic channel's name", async () => {
    answer(json(200, { title: "Mr. Brightside", author_name: "The Killers - Topic" }));
    assert.deepStrictEqual(await lookupSong("YOUTUBE", "topicAudio1"), {
      title: "Mr. Brightside",
      artist: "The Killers",
    });
  });

  it("returns null for a video that doesn't exist, without spending quota", async () => {
    for (const status of [400, 404]) {
      answer(text(status));
      assert.strictEqual(await lookupSong("YOUTUBE", "aaaaaaaaaaa"), null);
      assert.strictEqual(asked.length, 1, `status ${status}`);
    }
  });

  it("asks videos.list when oEmbed can't describe the video", async () => {
    // seen live: 401 when embedding is disabled, 403 for a private video, and a 200 with no
    // title or author_name for an ended live stream. 429 and 503 stand in for oEmbed having trouble.
    const oembedAnswers = [() => text(401), () => text(403), () => text(429), () => text(503), () => json(200, {})];
    for (const oembed of oembedAnswers) {
      answer(
        oembed(),
        json(200, {
          items: [{ snippet: { title: "Katy Perry - Roar (Official)", channelTitle: "KatyPerryVEVO" } }],
        }),
      );
      assert.deepStrictEqual(await lookupSong("YOUTUBE", "CevxZvSJLk8"), {
        title: "Roar",
        artist: "Katy Perry",
      });
      assert.strictEqual(asked.length, 2);
      assert.strictEqual(where(asked[1]!), "https://www.googleapis.com/youtube/v3/videos");
      assert.strictEqual(asked[1]!.searchParams.get("id"), "CevxZvSJLk8");
    }
  });

  it("returns null when videos.list doesn't have the video either", async () => {
    answer(text(401), json(200, { items: [] }));
    assert.strictEqual(await lookupSong("YOUTUBE", "privateVid1"), null);
  });

  it("reports the quota when the fallback has run out of it", async () => {
    answer(text(401), json(403, { error: { errors: [{ reason: "quotaExceeded" }] } }));
    await assert.rejects(lookupSong("YOUTUBE", "noEmbedVid1"), RateLimited);
  });
});

describe("searchSong on YouTube", () => {
  const video = (videoId: string, channelTitle: string) => ({ id: { videoId }, snippet: { channelTitle } });

  it("puts the artist's Topic upload first, then the artist's VEVO upload, then YouTube's order", async () => {
    answer(
      json(200, {
        items: [
          video("fanCover001", "Some Fan"),
          video("gGdGFtwCNBE", "TheKillersVEVO"),
          video("topicAudio1", "The Killers - Topic"),
          video("liveClip001", "BBC Music"),
        ],
      }),
    );
    assert.deepStrictEqual(await searchSong("YOUTUBE", "Mr. Brightside", "The Killers"), [
      "topicAudio1",
      "gGdGFtwCNBE",
      "fanCover001",
      "liveClip001",
    ]);
  });

  it("keeps YouTube's order for other artists' Topic and VEVO uploads", async () => {
    // seen live: a search for s**t kingz answered Outkast's "Roses" because it was on OutkastVEVO
    answer(
      json(200, {
        items: [
          video("5N-adb030jI", "DayDay.公式"),
          video("gWju37TZfo0", "OutkastVEVO"),
          video("otherTopic1", "Someone Else - Topic"),
          video("6-jF5O0FGlg", "s**t kingz - Topic"),
        ],
      }),
    );
    assert.deepStrictEqual(await searchSong("YOUTUBE", "Until Love Overflows", "s**t kingz"), [
      "6-jF5O0FGlg",
      "5N-adb030jI",
      "gWju37TZfo0",
      "otherTopic1",
    ]);
  });

  it("returns nothing when YouTube finds nothing", async () => {
    answer(json(200, { items: [] }));
    assert.deepStrictEqual(await searchSong("YOUTUBE", "愛が呆れ果てるまで", "s**t kingz"), []);
  });
});
