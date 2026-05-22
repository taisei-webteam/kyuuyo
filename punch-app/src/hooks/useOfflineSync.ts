import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const DB_NAME = 'rakuraku-punch-offline';
const STORE_NAME = 'pending_punches';
const DB_VERSION = 1;

interface PendingPunch {
  id: string;
  employee_id: number;
  employee_name: string;
  punch_type: 'clock_in' | 'clock_out';
  punched_at: string;
  device: 'ipad';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function savePending(punch: PendingPunch): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(punch);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllPending(): Promise<PendingPunch[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as PendingPunch[]);
    req.onerror = () => reject(req.error);
  });
}

async function removePending(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function flushPending(): Promise<number> {
  const pending = await getAllPending();
  let flushed = 0;

  for (const punch of pending) {
    const { error } = await supabase.from('punch_records').insert({
      employee_id: punch.employee_id,
      employee_name: punch.employee_name,
      punch_type: punch.punch_type,
      punched_at: punch.punched_at,
      device: punch.device,
    });
    if (!error) {
      await removePending(punch.id);
      flushed++;
    }
  }

  return flushed;
}

/**
 * オフライン時に打刻データを IndexedDB に保存し、
 * オンライン復帰時に Supabase へ自動送信するフック。
 */
export function useOfflineSync() {
  const flushingRef = useRef(false);

  useEffect(() => {
    const handleOnline = async () => {
      if (flushingRef.current) return;
      flushingRef.current = true;
      try {
        const count = await flushPending();
        if (count > 0) {
          console.log(`[OfflineSync] ${count} 件のオフライン打刻を同期しました`);
        }
      } finally {
        flushingRef.current = false;
      }
    };

    window.addEventListener('online', handleOnline);
    handleOnline();

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return { savePending, flushPending };
}
