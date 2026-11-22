import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const paths = {
  root: REPO_ROOT,
  assets: path.join(REPO_ROOT, 'assets'),
  registry: path.join(REPO_ROOT, 'assets/registry.json'),
  recipes: path.join(REPO_ROOT, 'assets/recipes'),
  sources: path.join(REPO_ROOT, 'assets/sources'),
  out: path.join(REPO_ROOT, 'apps/game/public/models'),
};
