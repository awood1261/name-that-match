import fs from 'node:fs';
import path from 'node:path';
import { ImportError } from './contracts.js';

const uuid = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const owned = new RegExp(`^(?:staging/${uuid}/${uuid}\\.(?:png|part|quarantine)|screenshots/${uuid}\\.png)$`);
export class ImportFiles {
  readonly root: string;
  constructor(root: string) {
    this.root = fs.realpathSync(root);
    this.directory('staging'); this.directory('screenshots');
  }
  private directory(relative: string): void {
    const full = path.join(this.root, relative);
    if (!fs.existsSync(full)) fs.mkdirSync(full);
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new ImportError('UNSAFE_STORAGE', 'Managed directory is not a real local directory.');
  }
  resolve(relative: string): string {
    if (!owned.test(relative)) throw new ImportError('UNSAFE_PATH', 'Invalid managed import reference.');
    const parts = relative.split('/');
    this.directory(parts[0]);
    if (parts[0] === 'staging') this.directory(`${parts[0]}/${parts[1]}`);
    const full = path.join(this.root, relative);
    try {
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink() || !stat.isFile()) throw new ImportError('UNSAFE_STORAGE', 'Managed file is not a regular file.');
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    return full;
  }
  exists(relative: string): boolean { return fs.existsSync(this.resolve(relative)); }
  openNew(relative: string): number { return fs.openSync(this.resolve(relative), fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600); }
  read(relative: string, maxBytes: number): Buffer {
    const descriptor = fs.openSync(this.resolve(relative), fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
      const size = fs.fstatSync(descriptor).size;
      if (size > maxBytes) throw new ImportError('IMAGE_TOO_LARGE', 'Managed file exceeds its byte limit.');
      const bytes = Buffer.alloc(size); let offset = 0;
      while (offset < size) {
        const read = fs.readSync(descriptor, bytes, offset, size - offset, offset);
        if (!read) throw new ImportError('INVALID_PNG', 'Managed file changed while reading.');
        offset += read;
      }
      if (fs.fstatSync(descriptor).size !== size) throw new ImportError('INVALID_PNG', 'Managed file changed while reading.');
      return bytes;
    } finally { fs.closeSync(descriptor); }
  }
  remove(relative: string): void {
    try { fs.unlinkSync(this.resolve(relative)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  renameStage(from: string, to: string): void {
    if (!from.startsWith('staging/') || !to.startsWith('staging/') || this.exists(to)) throw new ImportError('FINALIZATION_CONFLICT', 'Unexpected staging destination.');
    fs.renameSync(this.resolve(from), this.resolve(to));
  }
  quarantineFinal(from: string, to: string): void {
    if (!from.startsWith('screenshots/') || !to.startsWith('staging/') || !to.endsWith('.quarantine') || this.exists(to)) {
      throw new ImportError('FINALIZATION_CONFLICT', 'Cannot quarantine an unexpected file.');
    }
    fs.renameSync(this.resolve(from), this.resolve(to));
  }
  writeAll(descriptor: number, bytes: Uint8Array): void {
    let offset = 0;
    while (offset < bytes.length) {
      const written = fs.writeSync(descriptor, bytes, offset, bytes.length - offset);
      if (!written) throw new ImportError('IMPORT_IO_FAILED', 'Image write made no progress; check storage before retrying.', true);
      offset += written;
    }
  }
  /** Bounded read-only staging inventory. Never follows links or sweeps/deletes unknown entries. */
  inspectStaging(known: Set<string>) {
    const diagnostics: Array<{ code: string; label: string }> = [];
    let scanned = 0; let retainedBytes = 0; let truncated = false;
    const visit = (relative: string, depth: number) => {
      const directory = fs.opendirSync(path.join(this.root, relative));
      try {
        let entry: fs.Dirent | null;
        while ((entry = directory.readSync())) {
          if (++scanned > 4096) { truncated = true; break; }
          const child = `${relative}/${entry.name}`;
          const label = child.replace(/[\r\n\t]/g, '?');
          if (entry.isDirectory() && depth === 0 && /^[0-9a-f-]{36}$/i.test(entry.name)) visit(child, 1);
          else if (entry.isFile() && known.has(child)) retainedBytes += fs.lstatSync(path.join(this.root, child)).size;
          else if (diagnostics.length < 20) diagnostics.push({ code: 'UNKNOWN_STAGING_ENTRY', label });
          if (truncated) break;
        }
      } finally { directory.closeSync(); }
    };
    this.directory('staging'); visit('staging', 0);
    return { retainedBytes, diagnostics, scanned, truncated };
  }
}
