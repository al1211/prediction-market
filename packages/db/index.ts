// packages/db/index.ts (Aapke DB package ke andar)
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";


// Yeh check karne ke liye ki URL sahi mil rahi hai ya nahi



console.log("Data bse url",process.env.DATABASE_URL)

const adapter = new PrismaPg({
  connectionString:process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({
    adapter
});