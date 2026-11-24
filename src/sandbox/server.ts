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

const application = buildApplicationOn(db, {
  composition: { Sandbox: { Register, RegisterTwo, AddLink, Unregister, Find, Reject } },
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
  policy: httpPolicy({ basePath: "/api", publicErrors: { BAD_LINK: "INVALID_REQUEST" } }),
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

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env["SANDBOX_PORT"] ?? 3001),
  routes: {
    "/": () => new Response(Bun.file(`${import.meta.dir}/index.html`)),
    "/sandbox/state": {
      GET: async () => Response.json(await state(), { headers: { "Cache-Control": "no-store" } }),
    },
    "/sandbox/reset": {
      POST: async () => {
        await db.dropDatabase();
        flows.clear();
        steps.clear();
        calls.length = 0;
        return Response.json({});
      },
    },
  },
  async fetch(request) {
    if (!new URL(request.url).pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
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
