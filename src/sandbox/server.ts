// The Transpose sandbox: a local page for trying SongRegistering, Matching, and the Transposing
// reactions by hand. Start it with `bun run sandbox` and open the address it prints.
//
// It runs the application from build.ts with the real Spotify and YouTube APIs (keys from .env),
// on a throwaway in-memory database that's gone when the server stops.
import type { LogEntry } from "@mit-sdg/sync-engine/assembly";
import { createGateway, endpoint, receive, respond } from "@mit-sdg/sync-engine/boundary";
import { createHttpHandler } from "@mit-sdg/sync-engine-http/handler";
import { httpPolicy } from "@mit-sdg/sync-engine-http/policy";
import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { buildApplicationOn } from "../build.ts";
import { concepts } from "../concepts.ts";
import type { Playlist } from "../concepts/Playlisting.ts";
import { playlistEndpoints } from "./playlist-endpoints.ts";
import { exportPlaylist } from "./playlist-export.ts";
import { buildAccounts } from "./accounts.ts";
import { normalizeUsername, validUsername } from "../concepts/Authenticating.ts";
import { SESSION_SECONDS } from "../concepts/Sessioning.ts";

const { Matching, SongRegistering } = concepts;

// ---- endpoints for the page (the app's real endpoints are still to be designed) ----

const Register = endpoint(
  "/songs/register",
  ({ link, song }) =>
    receive({ link })
      .then(SongRegistering.register({ link }).responds({ song }))
      .then(respond({ song })),
  { input: { required: ["link"] } },
);

// both registrations happen in one request, which is when a reaction could mix up two songs
const RegisterTwo = endpoint(
  "/songs/register-two",
  ({ first, second, a, b }) =>
    receive({ first, second })
      .then(SongRegistering.register({ link: first }).responds({ song: a }))
      .then(SongRegistering.register({ link: second }).responds({ song: b }))
      .then(respond({ first: a, second: b })),
  { input: { required: ["first", "second"] } },
);

const AddLink = endpoint(
  "/songs/add-link",
  ({ song, link, owner }) =>
    receive({ song, link })
      .then(SongRegistering.addLink({ song, link }).responds({ song: owner }))
      .then(respond({ song: owner })),
  { input: { required: ["song", "link"] } },
);

const Unregister = endpoint(
  "/songs/unregister",
  ({ song }) =>
    receive({ song })
      .then(SongRegistering.unregister({ song }).responds({ song }))
      .then(respond({ song })),
  { input: { required: ["song"] } },
);

const Find = endpoint(
  "/matching/find",
  ({ platform, title, artist, match }) =>
    receive({ platform, title, artist })
      .then(Matching.find({ platform, title, artist }).responds({ match }))
      .then(respond({ match })),
  { input: { required: ["platform", "title", "artist"] } },
);

// "that was the wrong video": Matching moves on to the next result its search found
const Reject = endpoint(
  "/matching/reject",
  ({ match, songId }) =>
    receive({ match, songId })
      .then(Matching.reject({ match, songId }).responds({ match }))
      .then(respond({ match })),
  { input: { required: ["match", "songId"] } },
);

// ---- the activity log: every action each request ran, from the engine's log entries ----

type Step = {
  id: string;
  action: string;
  by?: string; // the reaction (or endpoint stage) that asked for it
  input: unknown;
  output?: unknown;
  error?: unknown;
  status: "running" | "returned" | "refused" | "faulted";
};
type Flow = { id: string; at: number; steps: Step[]; problems: string[] };

const flows = new Map<string, Flow>();
const steps = new Map<string, Step>();

function flowFor(id: string, at: number): Flow {
  let flow = flows.get(id);
  if (flow === undefined) {
    flow = { id, at, steps: [], problems: [] };
    flows.set(id, flow);
    // keep the 40 most recent
    for (const [oldId, old] of flows) {
      if (flows.size <= 40) break;
      for (const step of old.steps) steps.delete(step.id);
      flows.delete(oldId);
    }
  }
  return flow;
}

function record(entry: LogEntry) {
  switch (entry.kind) {
    case "invocation": {
      const { record } = entry;
      const step: Step = {
        id: record.id,
        action: `${record.concept.name}.${record.action.name}`,
        input: record.input,
        status: "running",
      };
      if (record.by !== undefined) step.by = record.by;
      flowFor(record.flow, entry.at).steps.push(step);
      steps.set(step.id, step);
      break;
    }
    case "outcome": {
      const step = steps.get(entry.id);
      if (step === undefined) break;
      if (entry.outcome.kind === "result") {
        step.status = "returned";
        step.output = entry.output;
      } else {
        step.status = "refused";
        step.error = entry.outcome.error;
      }
      break;
    }
    case "fault": {
      const step = steps.get(entry.id);
      if (step === undefined) break;
      step.status = "faulted";
      step.error = entry.fault;
      break;
    }
    case "reaction-failure": {
      const { reaction, flow, stage, errorClass } = entry.failure;
      flowFor(flow, entry.at).problems.push(`${reaction} failed at ${stage} (${errorClass})`);
      break;
    }
    case "integrity-failure":
      flowFor(entry.failure.flow, entry.at).problems.push(`integrity failure: ${entry.failure.kind}`);
      break;
  }
}

// ---- platform API calls, to see which ones ran and how many YouTube searches are used ----

type Call = { at: number; api: string; detail: string; status?: number; ms?: number; failed?: string };
const calls: Call[] = [];
let youtubeSearches = 0;

// names the platform API a request is for, leaving out the API key and other credentials
function platformCall(url: URL): { api: string; detail: string } | null {
  const param = (name: string) => url.searchParams.get(name) ?? "";
  if (url.host === "www.youtube.com" && url.pathname === "/oembed") {
    return { api: "YouTube oEmbed", detail: param("url") };
  }
  if (url.host === "www.googleapis.com" && url.pathname === "/youtube/v3/videos") {
    return { api: "YouTube videos.list", detail: param("id") };
  }
  if (url.host === "www.googleapis.com" && url.pathname === "/youtube/v3/search") {
    return { api: "YouTube search", detail: param("q") };
  }
  if (url.host === "api.spotify.com" && url.pathname.startsWith("/v1/tracks/")) {
    return { api: "Spotify track", detail: url.pathname.slice("/v1/tracks/".length) };
  }
  if (url.host === "api.spotify.com" && url.pathname === "/v1/search") {
    return { api: "Spotify search", detail: param("q") };
  }
  if (url.host === "accounts.spotify.com") return { api: "Spotify token", detail: "" };
  return null;
}

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const described = platformCall(new URL(input instanceof Request ? input.url : String(input)));
  if (described === null) return realFetch(input, init);
  if (described.api === "YouTube search") youtubeSearches++;
  const call: Call = { at: Date.now(), ...described };
  calls.unshift(call);
  calls.length = Math.min(calls.length, 60);
  const started = performance.now();
  try {
    const response = await realFetch(input, init);
    call.status = response.status;
    return response;
  } catch (error) {
    call.failed = String(error);
    throw error;
  } finally {
    call.ms = Math.round(performance.now() - started);
  }
}) as typeof fetch;

// .env.example's placeholder values count as not set
function isSet(name: string, placeholder: string) {
  const value = process.env[name];
  return value !== undefined && value !== "" && value !== placeholder;
}
const keys = {
  spotify: isSet("SPOTIFY_CLIENT_ID", "spotify-client-id") && isSet("SPOTIFY_CLIENT_SECRET", "spotify-client-secret"),
  youtube: isSet("YOUTUBE_API_KEY", "youtube-api-key"),
};

// ---- the server ----

const mongo = await MongoMemoryServer.create();
const client = await new MongoClient(mongo.getUri()).connect();
const db = client.db("sandbox");
const accounts = buildAccounts(client.db("sandboxAccounts"));

const sessionCookie = "transpose-session";
const cookieAttributes = "Path=/; HttpOnly; SameSite=Strict";
const noCache = { "Cache-Control": "no-store" };

async function signedInUser(request: Request) {
  const session = new Bun.CookieMap(request.headers.get("Cookie") ?? "").get(sessionCookie);
  const [active] = session ? await accounts.concepts.Sessioning._active({ session }) : [];
  return active?.subject;
}

async function endSession(request: Request) {
  const session = new Bun.CookieMap(request.headers.get("Cookie") ?? "").get(sessionCookie);
  if (session) await accounts.concepts.Sessioning.end({ session });
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  return !origin || origin === new URL(request.url).origin;
}

function signInRequired() {
  return Response.json({ error: "Sign in to use Transpose." }, { status: 401, headers: noCache });
}

async function accountRequest(request: Request, path: string) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  if (path === "/auth/sign-out") {
    await endSession(request);
    return Response.json({}, { headers: { ...noCache, "Set-Cookie": `${sessionCookie}=; ${cookieAttributes}; Max-Age=0` } });
  }
  const input = await request.json().catch(() => null);
  const username = typeof input?.username === "string" ? normalizeUsername(input.username) : "";
  const password = input?.password;
  if (!validUsername(username) || typeof password !== "string" || password.length < 8 || password.length > 128) {
    return Response.json({ error: "Use a 3–32 character username and an 8–128 character password." }, { status: 400, headers: noCache });
  }
  const result = await accounts.invoker.invoke(path, { username, password });
  if (!result.ok) {
    const registered = path === "/auth/register" && (await accounts.concepts.Authenticating._registered({ username })).registered;
    const error = registered ? "That username is already registered."
      : path === "/auth/sign-in" ? "Incorrect username or password." : "Could not create your account.";
    return Response.json({ error }, { status: registered ? 409 : path === "/auth/sign-in" ? 401 : 500, headers: noCache });
  }
  const { session } = result.value as { session: string };
  await endSession(request);
  return Response.json({ username }, {
    headers: { ...noCache, "Set-Cookie": `${sessionCookie}=${session}; ${cookieAttributes}; Max-Age=${SESSION_SECONDS}` },
  });
}

const application = buildApplicationOn(db, {
  composition: { Sandbox: { Register, RegisterTwo, AddLink, Unregister, Find, Reject, ...playlistEndpoints } },
  logSink: {
    append(entry) {
      try {
        record(entry);
      } catch (error) {
        console.error("sandbox log:", error);
      }
      return undefined;
    },
  },
});
const api = createHttpHandler({
  application,
  gateway: createGateway({ application }),
  policy: httpPolicy({
    basePath: "/api",
    publicErrors: {
      BAD_LINK: "INVALID_REQUEST",
      SHARING_DENIED: "INVALID_REQUEST",
      PLAYLIST_EXISTS: "INVALID_REQUEST",
      SONG_IN_PLAYLIST: "INVALID_REQUEST",
    },
  }),
  // the page sends an id with each request and finds that request in the activity log by it,
  // since an error response only says INVALID_REQUEST or INTERNAL_ERROR
  correlation: {
    resolve: (request) => request.headers.get("X-Request-Id") ?? undefined,
    responseHeader: "X-Request-Id",
  },
});

// The page shows everything in the database, so this reads the concepts' collections directly.
// The app itself only goes through their actions and queries.
async function state() {
  const read = (name: string) => db.collection(name).find().toArray();
  const [songs, matches, pauses] = await Promise.all([
    read("songRegistering.songs"),
    read("matching.matches"),
    read("matching.pauses"),
  ]);
  return { songs, matches, pauses, flows: [...flows.values()].reverse(), calls, youtubeSearches, keys };
}

async function playlistState(user: string) {
  const sharing = application.concepts.PlaylistSharing;
  const [visible, invites] = await Promise.all([
    sharing._getSharedPlaylists({ user }),
    sharing._getInvites({ invitee: user }),
  ]);
  const collection = db.collection<Playlist>("playlisting.playlists");
  const playlists = await collection
    .find({ $or: [{ owner: user }, { _id: { $in: visible.map(({ playlist }) => playlist) } }] }).toArray();
  const invitedPlaylists = await collection.find({ _id: { $in: invites.map(({ playlist }) => playlist) } })
    .project<Pick<Playlist, "_id" | "title">>({ title: 1 }).toArray();
  return {
    invites: invites.map((invite) => ({
      ...invite, title: invitedPlaylists.find(({ _id }) => _id === invite.playlist)?.title ?? "Playlist",
    })),
    playlists: await Promise.all(playlists.map(async ({ _id, title, owner, songs }) => {
      const [view, add, remove, members] = await Promise.all([
        sharing._canView({ playlist: _id, user }),
        sharing._canAdd({ playlist: _id, user }),
        sharing._canRemove({ playlist: _id, user }),
        sharing._getMembers({ playlist: _id }),
      ]);
      return view.allowed || owner === user ? {
        id: _id, title, owner, songs, sharing: view.allowed,
        canAdd: add.allowed, canRemove: remove.allowed,
        members: owner === user ? members : [],
      } : null;
    })).then((rows) => rows.filter((row) => row !== null)),
  };
}

function validPlaylistInput(body: unknown) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return false;
  const entries = Object.entries(body);
  return entries.every(([key, value]) => {
    if (key === "canAdd" || key === "canRemove") return typeof value === "boolean";
    return typeof value === "string" && value.length <= 200 && value.trim().length > 0;
  });
}

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env["SANDBOX_PORT"] ?? 3001),
  routes: {
    "/": () => new Response(Bun.file(`${import.meta.dir}/index.html`)),
    "/sandbox/state": {
      GET: async (request) => {
        const user = await signedInUser(request);
        return user ? Response.json({ user, ...await state() }, { headers: noCache }) : signInRequired();
      },
    },
    "/sandbox/playlists": {
      GET: async (request) => {
        const user = await signedInUser(request);
        if (!user) return signInRequired();
        return Response.json({ user, ...await playlistState(user) }, { headers: noCache });
      },
    },
    "/sandbox/reset": {
      POST: async (request) => {
        if (!sameOrigin(request)) return new Response(null, { status: 403 });
        if (!await signedInUser(request)) return signInRequired();
        await Promise.all(
          ["songRegistering.songs", "matching.matches", "matching.pauses"]
            .map((collection) => db.collection(collection).deleteMany({})),
        );
        flows.clear();
        steps.clear();
        calls.length = 0;
        return Response.json({});
      },
    },
  },
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (request.method === "POST" && ["/auth/register", "/auth/sign-in", "/auth/sign-out"].includes(path)) {
      return accountRequest(request, path);
    }
    if (!path.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }
    if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
    if (!sameOrigin(request)) return new Response(null, { status: 403 });
    const user = await signedInUser(request);
    if (!user) return signInRequired();
    if (path === "/api/playlists/export") {
      return exportPlaylist(await request.json().catch(() => null), user, {
        async loadPlaylist(id, user) {
          const playlist = await db.collection<Playlist>("playlisting.playlists").findOne({ _id: id });
          if (!playlist) return null;
          const { allowed } = await application.concepts.PlaylistSharing._canView({ playlist: id, user });
          return allowed || playlist.owner === user ? playlist : null;
        },
      });
    }
    if (path.startsWith("/api/playlists/") || path.startsWith("/api/invites/")) {
      const body = await request.json().catch(() => null);
      if (!validPlaylistInput(body)) return Response.json({ error: "INVALID_REQUEST" }, { status: 400 });
      if (path === "/api/playlists/invite") {
        const invitee = typeof body.invitee === "string" ? normalizeUsername(body.invitee) : "";
        if (!validUsername(invitee) || !(await accounts.concepts.Authenticating._registered({ username: invitee })).registered) {
          return Response.json({ error: "That username has no account." }, { status: 400 });
        }
        body.invitee = invitee;
      }
      const headers = new Headers(request.headers);
      headers.delete("Content-Length");
      headers.set("Content-Type", "application/json");
      request = new Request(request.url, { method: "POST", headers, body: JSON.stringify({ ...body, user }) });
    }
    const response = await api(request);
    // the page reads the songs right after this, so let the reactions add their links first
    await application.whenIdle();
    return response;
  },
});

async function stop() {
  await server.stop();
  await client.close();
  await mongo.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

console.log(`Transpose sandbox: ${server.url}`);
console.log("Real Spotify and YouTube APIs; a throwaway database that's cleared when you stop this.");
if (!keys.spotify) {
  console.warn("SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET isn't set in .env, so Spotify calls will fail.");
}
if (!keys.youtube) {
  console.warn("YOUTUBE_API_KEY isn't set in .env, so YouTube searches will fail. YouTube links still work.");
}
