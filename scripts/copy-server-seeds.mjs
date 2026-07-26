import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const sourceDirectory = path.join(repositoryRoot, 'server', 'src', 'db', 'seeds');
const destinationDirectory = path.join(repositoryRoot, 'server', 'dist', 'db', 'seeds');
const seedFiles = ['players.json', 'easy-players.json'];

await mkdir(destinationDirectory, { recursive: true });
await Promise.all(
  seedFiles.map((fileName) => copyFile(
    path.join(sourceDirectory, fileName),
    path.join(destinationDirectory, fileName)
  ))
);

console.log(`[server:build] copied ${seedFiles.length} player seed files`);
