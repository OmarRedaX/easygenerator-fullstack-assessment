import { performance } from 'node:perf_hooks';
import * as argon2 from 'argon2';

const memoryCost = Number(process.env.ARGON2_MEMORY_KIB ?? 19456);
const timeCost = Number(process.env.ARGON2_TIME_COST ?? 2);
const parallelism = Number(process.env.ARGON2_PARALLELISM ?? 1);
const RUNS = 10;

async function main(): Promise<void> {
  if (memoryCost < 19456 || timeCost < 2 || parallelism < 1) {
    process.stderr.write('Parameters are below the OWASP minimum (19456 KiB, t=2, p=1); the app would refuse to start.\n');
    process.exit(1);
  }
  const times: number[] = [];
  for (let i = 0; i < RUNS; i += 1) {
    const start = performance.now();
    await argon2.hash('benchmark-password-1!', { type: argon2.argon2id, memoryCost, timeCost, parallelism });
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b, 0) / RUNS;
  process.stdout.write(`argon2id m=${memoryCost}KiB t=${timeCost} p=${parallelism}: avg ${avg.toFixed(1)} ms over ${RUNS} hashes\n`);
  process.stdout.write('Run this on the deployment target and raise memory/time while signin latency stays acceptable.\n');
}

void main();
