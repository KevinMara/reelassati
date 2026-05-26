import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');

mkdirSync(distDir, { recursive: true });
writeFileSync(
  join(distDir, 'index.html'),
  '<!doctype html><html><head><meta charset="utf-8"><title>Reelassati</title></head><body><p>Next.js build output is served from .next.</p></body></html>\n',
);