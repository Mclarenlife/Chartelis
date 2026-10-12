import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

// Optional machine-local toolchain configuration, never included in source control.
const envFile = resolve('.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);
if (process.env.CARGO_HOME) {
  const key = Object.keys(process.env).find(key => key.toLowerCase() === 'path') || 'PATH';
  process.env[key] = join(process.env.CARGO_HOME, 'bin') + (process.platform === 'win32' ? ';' : ':') + (process.env[key] || '');
}
const require = createRequire(import.meta.url);
const cli = require.resolve('@tauri-apps/cli/tauri.js');
const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], { stdio: 'inherit', env: process.env });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
