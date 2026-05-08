import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

if (env !== "production") {
  console.log(`Skip Prisma predeploy (VERCEL_ENV=${env || "undefined"})`);
  process.exit(0);
}

execSync("npx prisma migrate status", { stdio: "inherit" });
execSync("npx prisma migrate deploy", { stdio: "inherit" });
