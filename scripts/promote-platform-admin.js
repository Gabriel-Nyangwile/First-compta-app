import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const emailArg = process.argv.find((arg) => arg.startsWith("--email="));
  const apply = process.argv.includes("--apply");
  const email = emailArg?.slice("--email=".length)?.trim();

  if (!email) {
    throw new Error("Usage: node --env-file=.env scripts/promote-platform-admin.js --email=user@example.com [--apply]");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, username: true, role: true },
  });

  if (!user) {
    throw new Error(`Utilisateur introuvable: ${email}`);
  }

  console.log(`mode: ${apply ? "apply" : "dry-run"}`);
  console.log(JSON.stringify(user, null, 2));

  if (!apply) return;

  await prisma.user.update({
    where: { id: user.id },
    data: { role: "PLATFORM_ADMIN" },
  });

  console.log("Promotion applied.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
