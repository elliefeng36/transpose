import type { Collection, Db } from "mongodb";
import type { Song } from "./SongRegistering.ts";

export class PlaylistExists extends Error {}
export class PlaylistNotFound extends Error {}
export class SongInPlaylist extends Error {}
export class SongNotInPlaylist extends Error {}

export interface Playlist {
  _id: string;
  title: string;
  owner: string;
  songs: Array<{
    song: Song;
    addedBy: string;
  }>;
}

export class PlaylistingConcept {
  private readonly playlists: Collection<Playlist>;

  constructor(
    db: Db,
    private readonly freshPlaylist: () => string = () => crypto.randomUUID(),
  ) {
    this.playlists = db.collection<Playlist>("playlisting.playlists");
  }

  async create({ title, owner }: { title: string; owner: string }) {
    const existing = await this.playlists.findOne({ title });
    if (existing !== null) {
      throw new PlaylistExists("Playlist already exists.");
    }

    const playlist = this.freshPlaylist();
    await this.playlists.insertOne({
      _id: playlist,
      title,
      owner,
      songs: [],
    });
    return { playlist };
  }

  async addSong({
    playlist,
    song,
    user,
  }: {
    playlist: string;
    song: Song;
    user: string;
  }) {
    const doc = await this.playlists.findOne({ _id: playlist });
    if (doc === null) {
      throw new PlaylistNotFound("Playlist not found.");
    }
    if (doc.songs.some((s) => s.song._id === song._id)) {
      throw new SongInPlaylist("Song already exists in the playlist.");
    }

    await this.playlists.updateOne(
      { _id: playlist },
      { $push: { songs: { song, addedBy: user } } },
    );
    return { song };
  }

  async removeSong({
    playlist,
    song,
  }: {
    playlist: string;
    song: Song;
  }) {
    const doc = await this.playlists.findOne({ _id: playlist });
    if (doc === null) {
      throw new PlaylistNotFound("Playlist not found.");
    }
    if (!doc.songs.some((s) => s.song._id === song._id)) {
      throw new SongNotInPlaylist("Song does not exist in the playlist.");
    }

    await this.playlists.updateOne(
      { _id: playlist },
      { $pull: { songs: { "song._id": song._id } as any } },
    );
    return { song };
  }

  async _getPlaylist({ title }: { title: string }) {
    const doc = await this.playlists.findOne({ title });
    if (doc === null) return [];
    return [{ playlist: doc._id }];
  }

  async _getSongs({ playlist }: { playlist: string }) {
    const doc = await this.playlists.findOne({ _id: playlist });
    if (doc === null) return [];
    return doc.songs.map((s) => ({ song: s.song }));
  }

  async _getSongsAddedByUser({
    user,
    playlist,
  }: {
    user: string;
    playlist: string;
  }) {
    const doc = await this.playlists.findOne({ _id: playlist });
    if (doc === null) return [];
    return doc.songs
      .filter((s) => s.addedBy === user)
      .map((s) => ({ song: s.song }));
  }
}
