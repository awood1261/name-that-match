import Database from 'better-sqlite3';
import { afterEach, expect, it, vi } from 'vitest';
import { initializeStorage } from '../../server/src/storage';
import { createTestResources } from '../helpers/resources';

const resources = createTestResources();
afterEach(async () => {
  vi.restoreAllMocks();
  await resources.cleanup();
});

it('closes SQLite if a pragma fails and preserves the original error', () => {
  const error = new Error('pragma failure');
  const close = vi.spyOn(Database.prototype, 'close');
  vi.spyOn(Database.prototype, 'pragma').mockImplementationOnce(() => { throw error; });
  expect(() => initializeStorage({ dataDir: resources.root })).toThrow(error);
  expect(close).toHaveBeenCalledTimes(1);
  expect(close.mock.instances[0].open).toBe(false);
});
