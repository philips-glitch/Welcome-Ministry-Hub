// Demo-mode photo storage in IndexedDB (localStorage is far too small for images).
// Stands in for the Supabase "submission-media" bucket; per browser only.
const DB = 'flourish-demo-media';
const STORE = 'media';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export const putMedia = (path, blob) => tx('readwrite', (s) => s.put(blob, path));
export const getMedia = (path) => tx('readonly', (s) => s.get(path));

const urls = new Map();
// Object URL for a stored photo (cached for the session), or null if it isn't there.
export async function mediaObjectUrl(path) {
  if (!path) return null;
  if (urls.has(path)) return urls.get(path);
  try {
    const blob = await getMedia(path);
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urls.set(path, url);
    return url;
  } catch { return null; }
}
