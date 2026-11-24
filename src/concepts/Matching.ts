import type { Collection, Db } from "mongodb";
import { originalLink, type Platform } from "../link-parsing-utils.ts";

/** Thrown by a search when the platform's quota or rate limit is used up. */
export class RateLimited extends Error {
  constructor(
    readonly platform: Platform,
    readonly until: Date,
  ) {
    super(`${platform} is rate limited until ${until.toISOString()}`);
  }
}

type Match = {
  _id: string;
  platform: Platform;
  title: string;
  artist: string;
  candidates: string[]; // what the search found, best first
  rejected: string[]; // candidates someone said are the wrong song
  songId?: string; // the first candidate that isn't rejected
  settled: boolean;
};

type Pause = { _id: Platform; until: number };

export class MatchingConcept {
  private readonly matches: Collection<Match>;
  private readonly pauses: Collection<Pause>;

  // search: the platform's ids for the songs that fit best, best first; empty when it has none.
  // It throws RateLimited when the quota is used up, or any other error when the call fails.
  constructor(
    db: Db,
    private readonly search: (
      platform: Platform,
      title: string,
      artist: string,
    ) => Promise<string[]>,
    private readonly clock: () => Date = () => new Date(),
    private readonly freshMatch: () => string = () => crypto.randomUUID(),
  ) {
    this.matches = db.collection<Match>("matching.matches");
    this.pauses = db.collection<Pause>("matching.pauses");
  }

  async find({
    platform,
    title,
    artist,
  }: {
    platform: Platform;
    title: string;
    artist: string;
  }) {
    const known = await this.matches.findOne({
      platform,
      title,
      artist,
      settled: true,
    });
    if (known !== null) return { match: known._id };

    const match: Match = {
      _id: this.freshMatch(),
      platform,
      title,
      artist,
      candidates: [],
      rejected: [],
      settled: true,
    };
    const now = this.clock().getTime();
    const pause = await this.pauses.findOne({ _id: platform });
    if (pause !== null && now < pause.until) {
      // out of quota: don't call the platform at all until it resets
      match.settled = false;
    } else {
      try {
        match.candidates = await this.search(platform, title, artist);
        const best = match.candidates[0];
        if (best !== undefined) match.songId = best;
      } catch (error) {
        match.settled = false;
        if (error instanceof RateLimited) {
          await this.pauses.updateOne(
            { _id: platform },
            { $set: { until: error.until.getTime() } },
            { upsert: true },
          );
        } else {
          // a one-off failure (network, 5xx): leave it unsettled so the next ask retries
          console.error(error);
        }
      }
    }
    await this.matches.insertOne(match);
    return { match: match._id };
  }

  // "That was the wrong song." The match moves on to the next candidate its search found, so this
  // never searches. Naming the song makes a repeated reject harmless: once the match has moved on,
  // rejecting the old song again leaves the new answer alone.
  async reject({ match: id, songId }: { match: string; songId: string }) {
    const match = await this.matches.findOne({ _id: id });
    if (match === null) return { match: id };
    const rejected = match.rejected.includes(songId) ? match.rejected : [...match.rejected, songId];
    const next = match.candidates.find((candidate) => !rejected.includes(candidate));
    if (next === undefined) {
      await this.matches.updateOne({ _id: id }, { $set: { rejected }, $unset: { songId: "" } });
    } else {
      await this.matches.updateOne({ _id: id }, { $set: { rejected, songId: next } });
    }
    return { match: id };
  }

  async _url({ match: id }: { match: string }) {
    const match = await this.matches.findOne({ _id: id });
    if (match === null || match.songId === undefined) return [];
    return [{ url: originalLink(match.platform, match.songId) }];
  }
}
