import http from "http";
import app from "@/app";
import { env } from "@/config/env";
import { connectDB, disconnectDB } from "@/config/db";

async function main() {
  await connectDB();

  // Socket.IO will attach to this http server in Phase 4
  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    console.log(`API running on http://localhost:${env.PORT}/api/v1`);
  });

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
