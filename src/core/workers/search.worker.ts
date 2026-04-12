import Fuse from 'fuse.js';

// Define the payload structure for messages sent to the worker
export interface IndexWorkerMessage {
  type: 'INDEX' | 'SEARCH' | 'CLEAR';
  payload?: any;
}

export interface SearchResult {
  id: string; // FilePair ID
}

// In-memory index instance inside the worker
let fuseInstance: Fuse<any> | null = null;
let indexData: any[] = [];

self.onmessage = async (event: MessageEvent<IndexWorkerMessage>) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'INDEX':
      // Expecting an array of serialized pairs with extracted metadata
      // e.g. payload = { id: 'image.jpg', stringifiedMeta: '...' }
      indexData = payload || [];
      fuseInstance = new Fuse(indexData, {
        keys: ['id', 'stringifiedMeta'],
        threshold: 0.3, // Fuzzy matching threshold
        ignoreLocation: true,
      });
      self.postMessage({ type: 'INDEX_COMPLETE', success: true, count: indexData.length });
      break;

    case 'SEARCH':
      if (!fuseInstance) {
        self.postMessage({ type: 'SEARCH_RESULTS', query: payload, results: [] });
        return;
      }
      
      const results = fuseInstance.search(payload as string);
      // Map back to just the IDs
      const mapped = results.map(r => ({ id: r.item.id }));
      self.postMessage({ type: 'SEARCH_RESULTS', query: payload, results: mapped });
      break;
      
    case 'CLEAR':
      indexData = [];
      fuseInstance = null;
      self.postMessage({ type: 'CLEAR_COMPLETE', success: true });
      break;

    default:
      console.warn(`Worker received unknown message type: ${type}`);
  }
};
