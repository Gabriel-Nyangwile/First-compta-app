import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptsDir, "..");

function resolveAliasPath(specifier) {
  const relativePath = specifier.slice(2);
  const basePath = path.join(workspaceRoot, "src", relativePath);
  const candidates = [
    basePath,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, "index.js"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith("@/")) {
    const resolvedPath = resolveAliasPath(specifier);
    if (!resolvedPath) {
      throw new Error(`Unable to resolve alias ${specifier}`);
    }
    return defaultResolve(pathToFileURL(resolvedPath).href, context, defaultResolve);
  }

  return defaultResolve(specifier, context, defaultResolve);
}