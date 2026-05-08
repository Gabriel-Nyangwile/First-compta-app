import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

if (env !== "production") {
  console.log(`Skip Prisma predeploy (VERCEL_ENV=${env || "undefined"})`);
  process.exit(0);
}

try {
  execSync("npx prisma migrate status", { stdio: "inherit" });
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
} catch (error) {
  console.error("Prisma predeploy check failed. Verify DATABASE_URL and pending migrations.");
  if (error?.message) {
    console.error(error.message);
  }
  process.exit(1);
}
