import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative, sep } from 'node:path';

export type MemeAsset = {
  id: string;
  category: string;
  name: string;
  filename: string;
  relativePath: string;
  absolutePath: string;
  extension: string;
  mimeType: string;
  animated: boolean;
  size: number;
};

export type MemeLibrarySnapshot = {
  root: string;
  categories: string[];
  memes: MemeAsset[];
};

export type MemeSelection = {
  category?: string;
  allowedCategories?: string[];
  disabledMemes?: string[];
};

const SUPPORTED_EXTENSIONS = new Set(['.gif', '.jpg', '.jpeg', '.png', '.webp']);

export class MemeLibrary {
  constructor(
    private readonly root: string,
    private readonly memes: MemeAsset[],
  ) {}

  all() {
    return this.memes.slice().sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  }

  getRoot() {
    return this.root;
  }

  list(selection?: MemeSelection) {
    const categoryFilter = normalizeCategoryList(selection?.allowedCategories);
    const disabled = normalizeIdList(selection?.disabledMemes);
    const selectedCategory = normalizeCategory(selection?.category);

    return this.all()
      .filter((meme) => {
        if (categoryFilter.length > 0 && !categoryFilter.includes(meme.category)) {
          return false;
        }
        if (selectedCategory && meme.category !== selectedCategory) {
          return false;
        }
        const normalizedId = normalizeId(meme.id);
        if (normalizedId && disabled.includes(normalizedId)) {
          return false;
        }
        return true;
      });
  }

  listCategories(selection?: MemeSelection) {
    const categoryFilter = normalizeCategoryList(selection?.allowedCategories);
    const filtered = this.list({ allowedCategories: categoryFilter });
    return [...new Set(filtered.map((meme) => meme.category))].sort((left, right) => left.localeCompare(right));
  }

  findById(id: string) {
    const normalized = normalizeId(id);
    if (!normalized) {
      return undefined;
    }

    return this.memes.find((meme) => normalizeId(meme.id) === normalized);
  }

  pickRandom(selection?: MemeSelection) {
    const candidates = this.list(selection);
    if (candidates.length === 0) {
      return undefined;
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  snapshot(selection?: MemeSelection): MemeLibrarySnapshot {
    return {
      root: this.root,
      categories: this.listCategories(selection),
      memes: this.list(selection),
    };
  }
}

export function createMemeLibrary(root: string) {
  return new MemeLibrary(root, scanMemeAssets(root));
}

export function scanMemeAssets(root: string) {
  if (!existsSync(root)) {
    return [];
  }

  const assets: MemeAsset[] = [];
  walkMemeDirectory(root, root, assets);
  return assets;
}

function walkMemeDirectory(root: string, current: string, assets: MemeAsset[]) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const absolutePath = join(current, entry.name);
    if (entry.isDirectory()) {
      walkMemeDirectory(root, absolutePath, assets);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = extname(entry.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      continue;
    }

    const relativePath = toPosixPath(relative(root, absolutePath));
    const category = relativePath.split('/')[0] || 'uncategorized';

    assets.push({
      id: relativePath,
      category,
      name: basename(entry.name, extension),
      filename: entry.name,
      relativePath,
      absolutePath,
      extension,
      mimeType: mimeTypeFromExtension(extension),
      animated: extension === '.gif',
      size: statSync(absolutePath).size,
    });
  }
}

function toPosixPath(value: string) {
  return value.split(sep).join('/');
}

function mimeTypeFromExtension(extension: string) {
  switch (extension) {
    case '.gif':
      return 'image/gif';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

function normalizeCategory(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized !== 'any' && normalized !== 'all' ? normalized : undefined;
}

function normalizeCategoryList(values: string[] | undefined) {
  if (!values || values.length === 0) {
    return [];
  }

  return [...new Set(values.map((value) => normalizeCategory(value)).filter((value): value is string => Boolean(value)))];
}

function normalizeId(value: string | undefined) {
  return value?.trim().replaceAll('\\', '/').toLowerCase();
}

function normalizeIdList(values: string[] | undefined) {
  if (!values || values.length === 0) {
    return [];
  }

  return [...new Set(values.map((value) => normalizeId(value)).filter((value): value is string => Boolean(value)))];
}
