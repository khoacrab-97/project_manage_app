import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

export function taoPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL chua duoc cau hinh.");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
