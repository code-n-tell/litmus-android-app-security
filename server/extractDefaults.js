import fs from "node:fs";
import path from "node:path";

const APP_PATH = path.resolve(process.cwd(), "src", "App.jsx");

const CONST_NAMES = [
  "platformFeatures",
  "risks",
  "riskConsequences",
  "riskObservations",
  "riskCallToAction",
  "riskNoteFormatted",
  "apps",
  "sectors",
];

function extractConstLiteral(source, name) {
  const declaration = `const ${name} =`;
  const declarationIndex = source.indexOf(declaration);
  if (declarationIndex === -1) {
    throw new Error(`Could not find declaration for ${name} in src/App.jsx`);
  }

  let start = declarationIndex + declaration.length;
  while (start < source.length && /\s/.test(source[start])) {
    start += 1;
  }

  const opening = source[start];
  const closing = opening === "[" ? "]" : opening === "{" ? "}" : null;
  if (!closing) {
    throw new Error(`Unsupported literal for ${name}; expected array/object.`);
  }

  let depth = 0;
  let inString = null;
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const char = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === "'" || char === '"' || char === "`") {
      inString = char;
      continue;
    }

    if (char === opening) {
      depth += 1;
      continue;
    }

    if (char === closing) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }

  throw new Error(`Could not parse literal for ${name}`);
}

function evaluateLiteral(literal, name) {
  try {
    return Function(`"use strict"; return (${literal});`)();
  } catch (error) {
    throw new Error(`Failed to evaluate literal for ${name}: ${error.message}`);
  }
}

export function loadDefaultsFromApp() {
  const source = fs.readFileSync(APP_PATH, "utf8");
  const result = {};

  for (const name of CONST_NAMES) {
    const literal = extractConstLiteral(source, name);
    result[name] = evaluateLiteral(literal, name);
  }

  return result;
}

