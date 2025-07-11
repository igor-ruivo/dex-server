#!/usr/bin/env node
const { spawn } = require("child_process");

const isWin = process.platform === "win32";
const debugEnv = "DEBUG=eslint:eslint";

// Comando a executar: npx eslint --fix ...
const eslintArgs = [
  "eslint",
  "--fix",
  "--ext",
  ".ts",
  "./src",
  "./package.json",
  "./prettier.config.cjs",
  "./tsconfig.json",
];

// Se for Windows, usa 'cross-env' para definir a variável DEBUG
const cmd = isWin ? "npx" : "env";
const args = isWin
  ? ["cross-env", debugEnv, "npx", ...eslintArgs]
  : [debugEnv, "npx", ...eslintArgs];

// Usar shell: true para funcionar bem no Windows e Unix
const child = spawn(cmd, args, { shell: true, stdio: "inherit" });

child.on("exit", (code) => process.exit(code));
