import type { SelectionManifest } from '../../../shared/src/imports';
function text(file: File, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => { reader.abort(); reject(new DOMException('Selection cancelled', 'AbortError')); };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    reader.onload = () => {
      signal.removeEventListener('abort', abort);
      try { resolve(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(new Uint8Array(reader.result as ArrayBuffer))); }
      catch { reject(new Error(`Metadata is not valid UTF-8: ${file.name}`)); }
    };
    reader.onerror = () => { signal.removeEventListener('abort', abort); reject(new Error(`Cannot read ${file.name}.`)); };
    reader.readAsArrayBuffer(file);
  });
}
export async function scanSelection(files: File[], signal: AbortSignal) {
  if (!files.length || files.length > 1024) throw new Error('Select 1–1,024 files. Split a larger selection into batches.');
  const manifest: SelectionManifest = { sourceLabel: 'Browser-selected captures', files: [] };
  const images = new Map<string, File[]>();
  for (const [index, file] of files.entries()) {
    if (signal.aborted) throw new DOMException('Selection cancelled', 'AbortError');
    const relativePath = (file.webkitRelativePath || file.name).normalize('NFC');
    const descriptor: SelectionManifest['files'][number] = { clientFileId: String(index), relativePath, byteSize: file.size };
    if (relativePath.endsWith('.json')) descriptor.metadataText = await text(file, signal);
    if (relativePath.endsWith('.png')) images.set(relativePath, [...(images.get(relativePath) ?? []), file]);
    manifest.files.push(descriptor);
  }
  return { manifest, images };
}
