import assert from "assert";
import { describe, it } from "bun:test";
import { originalLink, parseSongLink } from "../link-parsing-utils.ts";

const spotifyId = "4uLU6hMCjMI75M1A2tKUQC";
const youtubeId = "dQw4w9WgXcQ";

describe("parseSongLink", () => {
  it("should parse every Spotify link form", () => {
    const links = [
      `https://open.spotify.com/track/${spotifyId}`,
      `https://open.spotify.com/track/${spotifyId}?si=abc123`,
      `https://open.spotify.com/intl-de/track/${spotifyId}`,
      `open.spotify.com/track/${spotifyId}`,
      `spotify:track:${spotifyId}`,
      `  https://open.spotify.com/track/${spotifyId}  `,
      `HTTPS://Open.Spotify.com/track/${spotifyId}`,
    ];
    for (const link of links) {
      assert.deepStrictEqual(
        parseSongLink(link),
        { platform: "SPOTIFY", songId: spotifyId },
        link,
      );
    }
  });

  it("should parse every YouTube link form", () => {
    const links = [
      `https://www.youtube.com/watch?v=${youtubeId}`,
      `https://youtube.com/watch?v=${youtubeId}&t=42`,
      `https://m.youtube.com/watch?v=${youtubeId}`,
      `https://music.youtube.com/watch?v=${youtubeId}&list=RD${youtubeId}`,
      `https://youtu.be/${youtubeId}`,
      `https://youtu.be/${youtubeId}?si=xyz`,
      `youtu.be/${youtubeId}`,
    ];
    for (const link of links) {
      assert.deepStrictEqual(
        parseSongLink(link),
        { platform: "YOUTUBE", songId: youtubeId },
        link,
      );
    }
  });

  it("should reject albums, playlists, channels, other sites, and garbage", () => {
    const links = [
      "https://open.spotify.com/album/1ATL5GLyefJaxhQzSPVrLX",
      "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
      "https://open.spotify.com/track/tooshort",
      "https://www.youtube.com/playlist?list=PL123",
      "https://www.youtube.com/@channel",
      "https://www.youtube.com/watch?v=short",
      "https://example.com/track/4uLU6hMCjMI75M1A2tKUQC",
      "not a link",
      "",
    ];
    for (const link of links) {
      assert.strictEqual(parseSongLink(link), null, link);
    }
  });
});

describe("originalLink", () => {
  it("should build the original url for each platform", () => {
    assert.strictEqual(
      originalLink("SPOTIFY", spotifyId),
      `https://open.spotify.com/track/${spotifyId}`,
    );
    assert.strictEqual(
      originalLink("YOUTUBE", youtubeId),
      `https://www.youtube.com/watch?v=${youtubeId}`,
    );
  });
});
