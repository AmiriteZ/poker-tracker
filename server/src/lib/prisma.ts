import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  // Optional pool cap (e.g. small hosted Postgres plans); defaults to pg's 10.
  max: process.env.DATABASE_POOL_MAX ? Number(process.env.DATABASE_POOL_MAX) : undefined,
});

export const prisma = new PrismaClient({ adapter });
