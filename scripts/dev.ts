import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const port = 54329;
const user = "mesa";
const password = "mesa";
const database = "mesa";
const databaseDir = "data/pg";
const databaseUrl = `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`;

function ensureEnv() {
  if (existsSync(".env")) return;
  writeFileSync(
    ".env",
    [
      `DATABASE_URL=${databaseUrl}`,
      `TOKEN_ENCRYPTION_KEY=${randomBytes(32).toString("hex")}`,
      "APP_URL=http://localhost:3000",
      "TRUST_PROXY=false",
      `CRON_SECRET=${randomBytes(24).toString("hex")}`,
      "SEED_DEMO=true",
      "DEMO_PASSWORD=mesa-demo-2026",
      "DISABLE_INPROCESS_WORKER=false",
      "ENABLE_HSTS=false",
      "",
    ].join("\n"),
  );
}

async function main() {
  const postgres = new EmbeddedPostgres({ databaseDir, user, password, port, persistent: true });
  if (!existsSync(`${databaseDir}/PG_VERSION`)) await postgres.initialise();
  await postgres.start();
  try {
    await postgres.createDatabase(database);
  } catch {
    // La base ya existe.
  }
  ensureEnv();
  const envText = readFileSync(".env", "utf8");
  const fromFile = Object.fromEntries(envText.split("\n").filter((line) => line.includes("=")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  const env = { ...process.env, ...fromFile, DATABASE_URL: databaseUrl };
  await run("npx", ["prisma", "migrate", "deploy"], env);
  await run("npx", ["tsx", "prisma/seed.ts"], env);
  const child = spawn("npx", ["next", "dev"], { env, stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: "inherit" });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} salió con ${code}`))));
  });
}
