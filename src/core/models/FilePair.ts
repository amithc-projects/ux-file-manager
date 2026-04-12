export interface FilePair {
  id: string; // usually the path or main file name
  mainHandle: FileSystemFileHandle;
  sidecarHandle?: FileSystemFileHandle;
  
  // Optional metadata loaded asynchronously
  metadata?: Record<string, unknown>;
  thumbnailUrl?: string;
  size?: number;
  lastModified?: number;
}

export interface WorkspaceFolder {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
}

export type GridItem = 
  | { type: 'file', pair: FilePair }
  | { type: 'folder', handle: FileSystemDirectoryHandle, name: string, lastModified?: number, size?: number };

