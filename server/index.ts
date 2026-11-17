import { Elysia } from "elysia";

const app = new Elysia()
  .get("/health", () => ({ status: "ok" }))
  .listen({ port: 3000, hostname: "localhost" });

console.log(`API running at ${app.server?.url}`);
