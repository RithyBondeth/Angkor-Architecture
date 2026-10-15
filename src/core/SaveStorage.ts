/** Small storage boundary so recovery can be tested without a browser database. */
export interface SaveStorage {
  local: Pick<Storage, 'getItem' | 'setItem'>;
  read(key: string): Promise<unknown>;
  write(key: string, value: unknown): Promise<void>;
}
export class BrowserSaveStorage implements SaveStorage {
  private database: Promise<IDBDatabase> | null = null;
  get local(): Pick<Storage, 'getItem' | 'setItem'> {
    return localStorage;
  }
  private open(): Promise<IDBDatabase> {
    if (!this.database)
      this.database = new Promise((resolve, reject) => {
        const request = indexedDB.open('angkor-architect', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('saves');
        request.onsuccess = () => {
          request.result.onversionchange = () => request.result.close();
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Save database is busy.'));
      });
    return this.database;
  }
  async read(key: string): Promise<unknown> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const request = db.transaction('saves').objectStore('saves').get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async write(key: string, value: unknown): Promise<void> {
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
}
