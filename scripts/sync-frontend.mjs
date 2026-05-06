import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendDist = path.join(repoRoot, 'packages', 'frontend', 'dist');
const backendPublic = path.join(repoRoot, 'packages', 'backend', 'public');

await rm(backendPublic, { recursive: true, force: true });
await mkdir(path.dirname(backendPublic), { recursive: true });
await cp(frontendDist, backendPublic, { recursive: true });

console.log(`Synced frontend assets to ${path.relative(repoRoot, backendPublic)}`);
