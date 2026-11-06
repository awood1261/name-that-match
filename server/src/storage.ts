import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export const STORAGE_ENV_VAR = 'NAME_THAT_MATCH_DATA_DIR';
export const DEFAULT_DATA_DIRECTORY = path.resolve(process.cwd(), 'data');

export class StorageInitializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageInitializationError';
  }
}

export interface StorageSession {
  rootDir: string;
  dbPath: string;
  screenshotsDir: string;
  db: Database.Database;
}

export interface StorageOptions {
  dataDir?: string;
}

export function resolveDataDirectory(explicitDir?: string): string {
  const chosenDirectory = explicitDir ?? process.env[STORAGE_ENV_VAR] ?? DEFAULT_DATA_DIRECTORY;
  return path.resolve(chosenDirectory);
}

export function ensureDirectoryAccess(directoryPath: string): string {
  const resolvedPath = path.resolve(directoryPath);

  try {
    const stats = fs.statSync(resolvedPath);

    if (!stats.isDirectory()) {
      throw new StorageInitializationError(`Storage path is not a directory: ${resolvedPath}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      fs.mkdirSync(resolvedPath, { recursive: true });
    } else if (error instanceof StorageInitializationError) {
      throw error;
    } else {
      throw new StorageInitializationError(
        `Unable to access the configured data directory (${resolvedPath}): ${(error as Error).message}`,
      );
    }
  }

  try {
    fs.accessSync(resolvedPath, fs.constants.R_OK | fs.constants.W_OK);
  } catch (error) {
    throw new StorageInitializationError(
      `The data directory is not writable: ${resolvedPath}. ${(error as Error).message}`,
    );
  }

  return resolvedPath;
}

export function initializeStorage(options: StorageOptions = {}): StorageSession {
  const rootDir = ensureDirectoryAccess(resolveDataDirectory(options.dataDir));
  const screenshotsDir = ensureDirectoryAccess(path.join(rootDir, 'screenshots'));
  const dbPath = path.join(rootDir, 'library.sqlite');

  if (fs.existsSync(dbPath) && !fs.statSync(dbPath).isFile()) {
    throw new StorageInitializationError(
      `The configured SQLite path is invalid for storage initialization: ${dbPath}`,
    );
  }

  const db = new Database(dbPath, {
    readonly: false,
  });

  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  return {
    rootDir,
    dbPath,
    screenshotsDir,
    db,
  };
}

export function closeStorage(session?: StorageSession): void {
  if (!session) {
    return;
  }

  try {
    session.db.close();
  } catch (error) {
    console.error('Failed to close sqlite connection cleanly:', error);
  }
}
