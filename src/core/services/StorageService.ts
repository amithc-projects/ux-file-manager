import { get, set } from 'idb-keyval';
import { WorkspaceFolder } from '../models/FilePair';

export class StorageService {
  
  // --- PERMISSIONS ---
  static async verifyPermission(fileHandle: FileSystemHandle, mode: FileSystemPermissionMode = 'read'): Promise<boolean> {
    const opts = { mode };
    if ((await fileHandle.queryPermission(opts)) === 'granted') {
      return true;
    }
    if ((await fileHandle.requestPermission(opts)) === 'granted') {
      return true;
    }
    return false;
  }

  // --- WORKSPACES ---
  static async getWorkspaces(): Promise<WorkspaceFolder[]> {
    const spaces = await get<WorkspaceFolder[]>('sk_workspaces');
    return spaces || [];
  }

  static async saveWorkspace(handle: FileSystemDirectoryHandle): Promise<WorkspaceFolder[]> {
    const workspaces = await this.getWorkspaces();
    const existingIndex = workspaces.findIndex(w => w.name === handle.name);
    
    if (existingIndex !== -1) workspaces.splice(existingIndex, 1);
    
    const newWorkspace: WorkspaceFolder = {
      id: crypto.randomUUID(),
      name: handle.name,
      handle
    };
    
    const updated = [newWorkspace, ...workspaces];
    await set('sk_workspaces', updated);
    return updated;
  }

  static async removeWorkspace(id: string): Promise<WorkspaceFolder[]> {
    const workspaces = await this.getWorkspaces();
    const updated = workspaces.filter(w => w.id !== id);
    await set('sk_workspaces', updated);
    return updated;
  }
  
  static async clearWorkspaces(): Promise<void> {
    await set('sk_workspaces', []);
  }

  // --- BOOKMARKS ---
  static async getBookmarks(): Promise<WorkspaceFolder[]> {
    const list = await get<WorkspaceFolder[]>('sk_bookmarks');
    return list || [];
  }

  static async saveBookmark(handle: FileSystemDirectoryHandle): Promise<WorkspaceFolder[]> {
    const list = await this.getBookmarks();
    const existingIndex = list.findIndex(w => w.name === handle.name);
    
    if (existingIndex !== -1) list.splice(existingIndex, 1);
    
    const newBookmark: WorkspaceFolder = {
      id: crypto.randomUUID(),
      name: handle.name,
      handle
    };
    
    const updated = [newBookmark, ...list];
    await set('sk_bookmarks', updated);
    return updated;
  }

  static async removeBookmark(id: string): Promise<WorkspaceFolder[]> {
    const list = await this.getBookmarks();
    const updated = list.filter(w => w.id !== id);
    await set('sk_bookmarks', updated);
    return updated;
  }
}
