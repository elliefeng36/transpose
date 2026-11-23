import type { Collection, Db } from "mongodb";
import { originalLink, parseSongLink, type Platform } from "../link-parsing-utils.ts";

export class BadLink extends Error {}

export type Song = {
  _id: string;
  platform: Platform;
  title: string;
  artist: string;
  isrc?: string;
  default: { platform: Platform; songId: string; url: string };
  links: Array<{ platform: Platform; songId: string; url: string }>; // other variations of the default (e.g. music video v.s. lyric video for YouTube)
};

export class SongRegisteringConcept {
  private readonly songs: Collection<Song>;

  // lookup: null if the platform doesn't have the song
  // match: the platform's id for the same recording, else null
  constructor(
    db: Db,
    private readonly lookup: (
      platform: Platform,
      songId: string,
    ) => Promise<{ title: string; artist: string; isrc?: string } | null>,
    private readonly match: (
      platform: Platform,
      title: string,
      artist: string,
      isrc?: string,
    ) => Promise<string | null>,
    private readonly freshSong: () => string = () => crypto.randomUUID(),
  ) {
    this.songs = db.collection<Song>("songRegistering.songs");
  }

  async register({ link }: { link: string }) {
    const ref = parseSongLink(link);
    if (ref === null)
      throw new BadLink("That isn't a link to a song we can find.");

    const known = await this.#findByLink(ref.platform, ref.songId);
    if (known !== null) return { song: known._id };

    const details = await this.lookup(ref.platform, ref.songId);
    if (details === null)
      throw new BadLink("That isn't a link to a song we can find.");
    const newLink = {
      platform: ref.platform,
      songId: ref.songId,
      url: originalLink(ref.platform, ref.songId),
    };

    // the same recording on another release joins the song that already has its isrc
    if (details.isrc !== undefined) {
      const sameRecording = await this.songs.findOne({ isrc: details.isrc });
      if (sameRecording !== null) {
        await this.songs.updateOne(
          { _id: sameRecording._id },
          { $push: { links: newLink } },
        );
        return { song: sameRecording._id };
      }
    }

    const song: Song = {
      _id: this.freshSong(),
      platform: ref.platform,
      title: details.title,
      artist: details.artist,
      default: newLink,
      links: [],
    };
    if (details.isrc !== undefined) song.isrc = details.isrc;
    let other: Platform;
    if (ref.platform === "SPOTIFY") {
      other = "YOUTUBE";
    } else {
      other = "SPOTIFY";
    }
    const counterpart = await this.#findSongCounterpart(
      other,
      details.title,
      details.artist,
      details.isrc,
    );
    if (counterpart !== null) song.links.push(counterpart);
    await this.songs.insertOne(song);
    return { song: song._id };
  }

  async addLink({ song: id, link }: { song: string; link: string }) {
    const song = await this.songs.findOne({ _id: id });
    if (song === null) return { song: id };
    const ref = parseSongLink(link);
    if (ref === null)
      throw new BadLink("That isn't a link to a song we can find.");

    // a link that is already on a song, this one or another, answers that song
    const owner = await this.#findByLink(ref.platform, ref.songId);
    if (owner !== null) return { song: owner._id };

    const details = await this.lookup(ref.platform, ref.songId);
    if (details === null)
      throw new BadLink("That isn't a link to a song we can find.");
    const newLink = {
      platform: ref.platform,
      songId: ref.songId,
      url: originalLink(ref.platform, ref.songId),
    };
    await this.songs.updateOne({ _id: id }, { $push: { links: newLink } });
    return { song: id };
  }

  async unregister({ song }: { song: string }) {
    await this.songs.deleteOne({ _id: song });
    return { song };
  }

  async _details({ song: id }: { song: string }) {
    const song = await this.songs.findOne({ _id: id });
    if (song === null) return [];
    const row: {
      platform: Platform;
      title: string;
      artist: string;
      isrc?: string;
    } = {
      platform: song.platform,
      title: song.title,
      artist: song.artist,
    };
    if (song.isrc !== undefined) row.isrc = song.isrc;
    return [row];
  }

  async _links({ song: id }: { song: string }) {
    const song = await this.songs.findOne({ _id: id });
    if (song === null) return [];
    return song.links;
  }

  async _link({ song: id, platform }: { song: string; platform: Platform }) {
    const song = await this.songs.findOne({ _id: id });
    if (song === null) return [];
    const found = [song.default, ...song.links].find(
      (l) => l.platform === platform,
    );
    if (found === undefined) {
      return [];
    } else {
      return [{ url: found.url }];
    }
  }

  async _search({ text }: { text: string }) {
    const needle = text.trim();
    if (needle === "") return [];
    const pattern = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const found = await this.songs
      .find({
        $or: [
          { title: { $regex: pattern, $options: "i" } },
          { artist: { $regex: pattern, $options: "i" } },
        ],
      })
      .sort({ title: 1 })
      .toArray();
    return found.map((s) => ({
      song: s._id,
      platform: s.platform,
      title: s.title,
      artist: s.artist,
    }));
  }

  #findByLink(platform: Platform, songId: string) {
    return this.songs.findOne({
      $or: [
        { "default.platform": platform, "default.songId": songId },
        { links: { $elemMatch: { platform, songId } } },
      ],
    });
  }

  async #findSongCounterpart(
    platform: Platform,
    title: string,
    artist: string,
    isrc?: string,
  ): Promise<{ platform: Platform; songId: string; url: string } | null> {
    let songId: string | null;
    try {
      songId = await this.match(platform, title, artist, isrc);
    } catch {
      return null;
    }
    if (songId === null) return null;
    return { platform, songId, url: originalLink(platform, songId) };
  }
}
