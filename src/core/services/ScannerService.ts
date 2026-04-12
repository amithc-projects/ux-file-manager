import { FilePair } from '../models/FilePair';

export class ScannerService {
  /**
   * Scans a directory exactly one level deep, finding subfolders and grouping files with their sidecars.
   */
  static async scanDirectory(dirHandle: FileSystemDirectoryHandle): Promise<{ pairs: FilePair[], folders: FileSystemDirectoryHandle[] }> {
    const allFiles: FileSystemFileHandle[] = [];
    const folders: FileSystemDirectoryHandle[] = [];

    // @ts-ignore
    for await (const [name, entry] of dirHandle.entries()) {
      if (entry.kind === 'file') {
        allFiles.push(entry);
      } else if (entry.kind === 'directory') {
        folders.push(entry);
      }
    }

    const pairsMap = new Map<string, FilePair>();
    const sidecarsMap = new Map<string, FileSystemFileHandle>();
    const sidecarRegex = /^\.(?:meta_)?(.+)$/;

    for (const file of allFiles) {
      const match = file.name.match(sidecarRegex);
      if (match) {
        const mainName = match[1];
        sidecarsMap.set(mainName, file);
      } else {
        pairsMap.set(file.name, {
          id: file.name,
          mainHandle: file,
          size: 0,
          lastModified: 0
        });
      }
    }

    for (const [mainName, sidecarHandle] of sidecarsMap.entries()) {
      const pair = pairsMap.get(mainName);
      if (pair) pair.sidecarHandle = sidecarHandle;
    }

    const pairs = Array.from(pairsMap.values());
    
    // Fetch system metadata (size, exact date) lazily without blocking UI entirely, 
    // but fast enough to populate the sort order. 
    await Promise.all(pairs.map(async (p) => {
      try {
        const f = await p.mainHandle.getFile();
        p.size = f.size;
        p.lastModified = f.lastModified;
      } catch (e) {}
    }));

    return { pairs, folders };
  }

  /**
   * Reads a given sidecar and parses it as JSON if possible.
   */
  static async readSidecarMetadata(handle: FileSystemFileHandle | undefined): Promise<Record<string, unknown> | undefined> {
    if (!handle) return undefined;
    try {
      const file = await handle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch (err) {
      console.warn(`Failed to parse metadata from sidecar ${handle.name}`, err);
      return undefined;
    }
  }
}
