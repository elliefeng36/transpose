import { buildApplication } from "./build.ts";
import { db } from "./db.ts";

// assemble at startup
buildApplication();

const server = Bun.serve({
  hostname: process.env["HOST"] ?? "127.0.0.1",
  port: Number(process.env["PORT"] ?? 3000),
  routes: {
    "/health": async () => {
      try {
        await db.command({ ping: 1 }, { timeoutMS: 3000 });
        return Response.json(
          { status: "ok" },
          { headers: { "Cache-Control": "no-store" } },
        );
      } catch {
        return Response.json(
          { status: "unavailable" },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    },
  },
});

console.log(`backend listening on ${server.url}`);
