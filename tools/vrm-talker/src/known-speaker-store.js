const DB_NAME = 'subeha-vrm-studio';
const STORE = 'assets';
const KEY = 'known-speaker-host';

const openDb = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
});

export const saveKnownSpeakerReference = async (file, name = 'HOST') => {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({name, file, savedAt: Date.now()}, KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Known speaker save failed'));
    });
  } finally {
    db.close();
  }
};

export const getKnownSpeakerReference = async () => {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Known speaker read failed'));
    });
  } finally {
    db.close();
  }
};

export const forgetKnownSpeakerReference = async () => {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('Known speaker delete failed'));
    });
  } finally {
    db.close();
  }
};
