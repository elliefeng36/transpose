import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import assert from "node:assert/strict";
import { assemble } from "@mit-sdg/sync-engine/assembly";
import { applicationConceptSet } from "../concepts.ts";
import { MatchingConcept } from "../concepts/Matching.ts";
import { PlaylistingConcept } from "../concepts/Playlisting.ts";
import { PlaylistSharingConcept } from "../concepts/PlaylistSharing.ts";
import { SongRegisteringConcept } from "../concepts/SongRegistering.ts";
import { composition as sharing } from "../compositions/SharingPlaylists.ts";
import { playlistEndpoints } from "../sandbox/playlist-endpoints.ts";
import { openTestDb, type TestDb } from "./test-db.ts";

let testDb: TestDb | undefined;
let app: ReturnType<typeof build>;

function build({ db }: TestDb) {
  return assemble({
    conceptSet: applicationConceptSet,
    instances: {
      Matching: new MatchingConcept(db, async () => []),
      Playlisting: new PlaylistingConcept(db),
      PlaylistSharing: new PlaylistSharingConcept(db),
      SongRegistering: new SongRegisteringConcept(
        db,
        async () => ({ title: "Mr. Brightside", artist: "The Killers" }),
        async () => null,
      ),
    },
    composition: { SharingPlaylists: sharing, Sandbox: playlistEndpoints },
  });
}

const owner = "Alex";
const member = "Sam";
const outsider = "Jordan";

async function invoke(path: string, body: Record<string, string | boolean>) {
  const result = await app.invoker.invoke(path, body);
  await app.whenIdle();
  return result;
}

async function create(title: string) {
  const result = await invoke("/playlists/create", { title, user: owner });
  assert.ok(result.ok, JSON.stringify(result));
  return (result.value as { playlist: string }).playlist;
}

async function invite(playlist: string, invitee = member) {
  const result = await invoke("/playlists/invite", { playlist, user: owner, invitee });
  assert.ok(result.ok, JSON.stringify(result));
  return (result.value as { invite: string }).invite;
}

beforeAll(async () => {
  testDb = await openTestDb();
  app = build(testDb);
}, 120_000);

afterAll(async () => {
  await testDb?.close();
});

describe("PlaylistSharing", () => {
  it("initializes the owner and enforces playlist visibility and song editing permissions", async () => {
    const playlist = await create("Collaborative tracks");
    const sharing = app.concepts.PlaylistSharing;
    expect(await sharing._getSharedPlaylists({ user: owner })).toContainEqual({ playlist });
    expect(await sharing._canView({ playlist, user: outsider })).toEqual({ allowed: false });

    const song = await app.concepts.SongRegistering.register({
      link: "https://open.spotify.com/track/003vvx7Niy0yvhvHt4a68B",
    }) as { song: string };
    const id = song.song;
    expect(typeof id).toBe("string");

    const invitation = await invite(playlist);
    expect(await sharing._getInvites({ invitee: member })).toEqual([
      { invite: invitation, playlist, inviter: owner, invitee: member },
    ]);
    expect((await invoke("/playlists/add-song", { playlist, user: member, id })).ok).toBe(false);
    expect((await invoke("/invites/accept", { invite: invitation, user: outsider })).ok).toBe(false);
    expect((await invoke("/invites/accept", { invite: invitation, user: member })).ok).toBe(true);
    expect(await sharing._getInvites({ invitee: member })).toEqual([]);
    expect(await sharing._getSharedPlaylists({ user: member })).toContainEqual({ playlist });

    expect((await invoke("/playlists/add-song", { playlist, user: member, id })).ok).toBe(true);
    expect(await app.concepts.Playlisting._getSongsAddedByUser({ playlist, user: member })).toHaveLength(1);
    expect((await invoke("/playlists/remove-song", { playlist, user: member, id })).ok).toBe(false);
    expect((await invoke("/playlists/permissions", {
      playlist, user: member, member, canAdd: false, canRemove: true,
    })).ok).toBe(false);
    expect((await invoke("/playlists/permissions", {
      playlist, user: owner, member, canAdd: false, canRemove: true,
    })).ok).toBe(true);
    expect((await invoke("/playlists/remove-song", { playlist, user: member, id })).ok).toBe(true);
    expect((await invoke("/playlists/add-song", { playlist, user: member, id })).ok).toBe(false);
    expect(await app.concepts.Playlisting._getSongs({ playlist })).toEqual([]);

    expect((await invoke("/playlists/remove-member", { playlist, user: owner, member })).ok).toBe(true);
    expect(await sharing._canView({ playlist, user: member })).toEqual({ allowed: false });
  });

  it("rejects duplicate and unauthorized invites and supports declining and leaving", async () => {
    const playlist = await create("Invitation lifecycle");
    expect((await invoke("/playlists/invite", { playlist, user: outsider, invitee: member })).ok).toBe(false);
    const first = await invite(playlist);
    expect((await invoke("/playlists/invite", { playlist, user: owner, invitee: member })).ok).toBe(false);
    expect((await invoke("/invites/decline", { invite: first, user: member })).ok).toBe(true);
    expect((await invoke("/invites/accept", { invite: first, user: member })).ok).toBe(false);
    const second = await invite(playlist);
    expect((await invoke("/invites/accept", { invite: second, user: member })).ok).toBe(true);
    expect((await invoke("/playlists/leave", { playlist, user: member })).ok).toBe(true);
    expect(await app.concepts.PlaylistSharing._canAdd({ playlist, user: member })).toEqual({ allowed: false });
  });

  it("clears memberships and pending invitations when the owner stops sharing", async () => {
    const playlist = await create("Stop sharing");
    const invitation = await invite(playlist);
    await invoke("/invites/accept", { invite: invitation, user: member });
    await invite(playlist, outsider);
    const sharing = app.concepts.PlaylistSharing;
    expect((await invoke("/playlists/stop-sharing", { playlist, user: member })).ok).toBe(false);
    expect((await invoke("/playlists/stop-sharing", { playlist, user: owner })).ok).toBe(true);
    expect(await sharing._getMembers({ playlist })).toEqual([]);
    expect(await sharing._getInvites({ invitee: outsider })).toEqual([]);
    expect(await sharing._canView({ playlist, user: member })).toEqual({ allowed: false });
    expect((await invoke("/playlists/start-sharing", { playlist, user: member })).ok).toBe(false);
    expect((await invoke("/playlists/start-sharing", { playlist, user: owner })).ok).toBe(true);
    expect(await sharing._canView({ playlist, user: owner })).toEqual({ allowed: true });
  });
});
