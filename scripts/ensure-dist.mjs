import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');

mkdirSync(distDir, { recursive: true });
// Not creating a dummy index.html as it breaks the preview.
