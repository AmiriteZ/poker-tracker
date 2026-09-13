import "dotenv/config";
import { defineConfig } from "prisma/config";

// DATABASE_URL comes from server/.env (see .env.example). The fallback lets
// `prisma generate` run on a fresh checkout before .env exists.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://poker:poker@localhost:5432/poker_tracker?schema=public",
  },
});
