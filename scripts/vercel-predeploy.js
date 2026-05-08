import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

if (env !== "production") {
  console.log(`Skip Prisma predeploy (VERCEL_ENV=${env || "undefined"})`);
  process.exit(0);
}

function run(command, context) {
  try {
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error(`${context} failed. Verify DATABASE_URL and migration state.`);
    if (error?.message) {
      console.error(error.message);
    }
    process.exit(1);
  }
}

run("npx prisma migrate status", "Prisma migrate status");
run("npx prisma migrate deploy", "Prisma migrate deploy");
