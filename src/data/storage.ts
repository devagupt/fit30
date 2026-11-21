import { appDataSchema, emptyData, type Fit30Data } from '../domain/model';

const databaseName = 'fit30';
const storeName = 'progress';
const recordKey = 'current';

export interface DataSnapshot {
  data: Fit30Data;
  revision: number;
}

export type DataUpdate = (current: Fit30Data) => Fit30Data;

export class DataConflictError extends Error {
  constructor(readonly snapshot: DataSnapshot) {
    super('Your Fit30 data changed. Review the latest information and try again.');
    this.name = 'DataConflictError';
  }
}

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('This browser did not provide access to Fit30’s local storage.'));
      return;
    }

    const request = indexedDB.open(databaseName, 1);
    let blocked = false;

    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Close your other Fit30 tabs and try opening your saved progress again.'));
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      if (blocked) {
        database.close();
        return;
      }

      database.onversionchange = () => {
        database.close();
        databasePromise = undefined;
      };
      database.onclose = () => { databasePromise = undefined; };
      resolve(database);
    };
  }).catch((error: unknown) => {
    databasePromise = undefined;
    throw error;
  });

  return databasePromise;
}

function decodeSnapshot(value: unknown): DataSnapshot {
  if (value === undefined) return { data: structuredClone(emptyData), revision: 0 };

  if (typeof value === 'object' && value !== null && 'data' in value && 'revision' in value) {
    const { data, revision } = value;
    const parsed = appDataSchema.safeParse(data);
    if (parsed.success && typeof revision === 'number' && Number.isSafeInteger(revision) && revision > 0) {
      return { data: parsed.data, revision };
    }
  }

  throw new Error('Fit30 couldn’t read your saved data. Your existing records are still on this device.');
}

async function transact(update?: DataUpdate, expectedRevision?: number): Promise<DataSnapshot> {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, update ? 'readwrite' : 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(recordKey);
    let result: DataSnapshot;
    let failure: unknown;

    request.onsuccess = () => {
      try {
        const current = decodeSnapshot(request.result);
        result = current;
        if (!update) return;
        if (expectedRevision !== undefined && current.revision !== expectedRevision) {
          throw new DataConflictError(current);
        }

        const next = update(current.data);
        if (next === current.data) return;

        const parsed = appDataSchema.safeParse(next);
        if (!parsed.success) throw new Error('This change couldn’t be saved. Your previous progress is still available.');
        result = { data: parsed.data, revision: current.revision + 1 };
        store.put(result, recordKey);
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };

    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(failure ?? transaction.error ?? new Error('Local storage was interrupted.'));
  });
}

export function readData(): Promise<DataSnapshot> {
  return transact();
}

export function updateData(update: DataUpdate, expectedRevision?: number): Promise<DataSnapshot> {
  return transact(update, expectedRevision);
}
