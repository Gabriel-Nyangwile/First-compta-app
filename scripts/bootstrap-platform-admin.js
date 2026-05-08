#!/usr/bin/env node
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma.js";

const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.PLATFORM_ADMIN_PASSWORD;
const username = process.env.PLATFORM_ADMIN_USERNAME?.trim() || "platform-admin";

async function main() {
  if (!email || !password) {
    throw new Error(
      "PLATFORM_ADMIN_EMAIL et PLATFORM_ADMIN_PASSWORD sont requis pour le bootstrap.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, role: true, isActive: true },
  });

  if (existing) {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        email,
        username,
        password: passwordHash,
        role: "PLATFORM_ADMIN",
        isActive: true,
        canCreateCompany: true,
      },
      select: { id: true, email: true, role: true, isActive: true, canCreateCompany: true },
    });
    console.log(`PLATFORM_ADMIN updated: ${user.email}`);
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: passwordHash,
      role: "PLATFORM_ADMIN",
      isActive: true,
      canCreateCompany: true,
    },
    select: { id: true, email: true, role: true, isActive: true, canCreateCompany: true },
  });
  console.log(`PLATFORM_ADMIN created: ${user.email}`);
}

main()
  .catch((error) => {
    console.error("Bootstrap PLATFORM_ADMIN failed:", error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
