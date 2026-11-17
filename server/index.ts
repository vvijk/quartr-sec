import { createApp } from "./app";

const app = createApp().listen({ port: 3000, hostname: "localhost" });

console.log(`API running at ${app.server?.url}`);
