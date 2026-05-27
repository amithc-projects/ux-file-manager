/**
 * SidecarService — write and merge sidecar JSON files.
 * Sidecar format: `.{filename}.json` stored alongside the main file.
 */
export class SidecarService {
  /**
   * Write (create or update) a sidecar for the given file.
   * Merges `patch` on top of any existing sidecar data, preserving keys not in `patch`.
   */
  static async writeSidecar(
    dirHandle: FileSystemDirectoryHandle,
    fileName: string,
    patch: Record<string, unknown>
  ): Promise<void> {
    const sidecarName = `.${fileName}.json`;

    // Read existing sidecar (if any) so we can merge
    let existing: Record<string, unknown> = {};
    try {
      const existingHandle = await dirHandle.getFileHandle(sidecarName);
      const file = await existingHandle.getFile();
      existing = JSON.parse(await file.text());
    } catch {
      // No existing sidecar — start fresh
    }

    const merged = { ...existing, ...patch };

    const fileHandle = await dirHandle.getFileHandle(sidecarName, { create: true });
    const writable = await (fileHandle as any).createWritable();
    await writable.write(JSON.stringify(merged, null, 2));
    await writable.close();
  }

  /**
   * Merge a value into the nested `asset` key of a sidecar.
   * e.g. writeAsset(dir, 'photo.jpg', { name: 'Alice' })
   *   → sidecar becomes { ..., asset: { ...existing.asset, name: 'Alice' } }
   */
  static async writeAsset(
    dirHandle: FileSystemDirectoryHandle,
    fileName: string,
    assetPatch: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const sidecarName = `.${fileName}.json`;

    let existing: Record<string, unknown> = {};
    try {
      const existingHandle = await dirHandle.getFileHandle(sidecarName);
      const file = await existingHandle.getFile();
      existing = JSON.parse(await file.text());
    } catch {
      // New sidecar
    }

    const merged: Record<string, unknown> = {
      ...existing,
      asset: { ...(existing.asset as Record<string, unknown> ?? {}), ...assetPatch },
    };

    const fileHandle = await dirHandle.getFileHandle(sidecarName, { create: true });
    const writable = await (fileHandle as any).createWritable();
    await writable.write(JSON.stringify(merged, null, 2));
    await writable.close();

    return merged;
  }
}
