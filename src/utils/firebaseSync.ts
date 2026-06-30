import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import defaultFirebaseConfig from '../../firebase-applet-config.json';

// Use environment variables if provided (useful for secure Vercel/GitHub deployments), 
// otherwise fall back to local JSON configuration.
const metaEnv = (import.meta as any).env || {};
const firebaseConfig = {
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
  appId: metaEnv.VITE_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
  measurementId: metaEnv.VITE_FIREBASE_MEASUREMENT_ID || defaultFirebaseConfig.measurementId || "",
  firestoreDatabaseId: metaEnv.VITE_FIREBASE_DATABASE_ID || defaultFirebaseConfig.firestoreDatabaseId
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Synced keys mapping: localStorageKey -> firestoreCollection
const SYNC_KEYS: Record<string, string> = {
  'makayasa_expenses': 'expenses',
  'makayasa_sales_deposits': 'sales_deposits',
  'makayasa_freelance_records': 'freelance_records',
  'makayasa_stok_gudang': 'stok_gudang'
};

const CONFIG_KEY = 'makayasa_owner_config';

// Flag to prevent infinite loop (server update triggering upload)
let isSyncingFromServer = false;

// Active listeners to avoid duplicates
const activeListeners: Record<string, () => void> = {};

// Helper to check if two arrays/objects are equal (simple serialization check)
function isDataEqual(a: any, b: any): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  if (a.length !== b.length) return false;
  // Sort copies by id to compare content stability
  const sortedA = [...a].sort((x, y) => (x.id || '').localeCompare(y.id || ''));
  const sortedB = [...b].sort((x, y) => (x.id || '').localeCompare(y.id || ''));
  return JSON.stringify(sortedA) === JSON.stringify(sortedB);
}

/**
 * Sync from client (localStorage) to Firestore server
 */
async function syncLocalToServer(key: string, rawValue: string | null) {
  if (isSyncingFromServer) return;

  try {
    if (key === CONFIG_KEY) {
      if (!rawValue) return;
      const parsedConfig = JSON.parse(rawValue);
      await setDoc(doc(db, 'owner_config', 'global'), parsedConfig);
      console.log('Firebase Sync: Config updated on server');
      return;
    }

    const collectionName = SYNC_KEYS[key];
    if (!collectionName) return;

    if (!rawValue) {
      // Key was removed, delete all docs in this collection
      const snapshot = await getDocs(collection(db, collectionName));
      const batch = writeBatch(db);
      snapshot.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      console.log(`Firebase Sync: Cleared collection ${collectionName} on server`);
      return;
    }

    const localArray = JSON.parse(rawValue);
    if (!Array.isArray(localArray)) return;

    // Get current IDs on server to find deletions
    const serverSnapshot = await getDocs(collection(db, collectionName));
    const serverIds = serverSnapshot.docs.map(d => d.id);
    const localIds = localArray.map((item: any) => item.id).filter(Boolean);

    // Batch writes to be efficient
    const batch = writeBatch(db);
    let operationCount = 0;

    // 1. Write or update local items to server
    localArray.forEach((item: any) => {
      if (item && item.id) {
        const docRef = doc(db, collectionName, item.id);
        batch.set(docRef, item);
        operationCount++;
      }
    });

    // 2. Delete items that no longer exist in local array
    serverIds.forEach(id => {
      if (!localIds.includes(id)) {
        const docRef = doc(db, collectionName, id);
        batch.delete(docRef);
        operationCount++;
      }
    });

    if (operationCount > 0) {
      await batch.commit();
      console.log(`Firebase Sync: Uploaded ${operationCount} changes for ${collectionName} to server`);
    }
  } catch (error) {
    console.error(`Firebase Sync: Error uploading ${key} to server`, error);
  }
}

/**
 * Initialize listeners for each Firestore collection
 */
export function initializeFirebaseSync() {
  console.log('Firebase Sync: Initializing real-time cross-device synchronization...');

  // --- 1. SET UP REAL-TIME LISTENERS (SERVER -> CLIENT) ---
  
  // A. Listen to standard collection lists
  Object.entries(SYNC_KEYS).forEach(([localKey, collectionName]) => {
    // Unsubscribe if listener exists
    if (activeListeners[localKey]) {
      activeListeners[localKey]();
    }

    activeListeners[localKey] = onSnapshot(collection(db, collectionName), (snapshot) => {
      try {
        const serverData = snapshot.docs.map(doc => doc.data());
        const currentLocalRaw = localStorage.getItem(localKey);
        const currentLocal = currentLocalRaw ? JSON.parse(currentLocalRaw) : [];

        const finalArray = serverData;

        // Avoid rewrite if equal
        if (!isDataEqual(currentLocal, finalArray)) {
          isSyncingFromServer = true;
          localStorage.setItem(localKey, JSON.stringify(finalArray));
          isSyncingFromServer = false;

          console.log(`Firebase Sync: Collection ${collectionName} updated from server. Syncing local state.`);
          // Trigger React component re-render
          window.dispatchEvent(new CustomEvent('makayasa_sync_update', { detail: { key: localKey } }));
        }
      } catch (err) {
        console.error(`Firebase Sync: Error in listener for ${collectionName}`, err);
      }
    });
  });

  // B. Listen to owner config
  if (activeListeners[CONFIG_KEY]) {
    activeListeners[CONFIG_KEY]();
  }
  activeListeners[CONFIG_KEY] = onSnapshot(doc(db, 'owner_config', 'global'), (docSnap) => {
    try {
      if (docSnap.exists()) {
        const serverConfig = docSnap.data();
        const localConfigRaw = localStorage.getItem(CONFIG_KEY);
        const localConfig = localConfigRaw ? JSON.parse(localConfigRaw) : null;

        if (!isDataEqual(localConfig, serverConfig)) {
          isSyncingFromServer = true;
          localStorage.setItem(CONFIG_KEY, JSON.stringify(serverConfig));
          isSyncingFromServer = false;

          console.log('Firebase Sync: Config updated from server.');
          window.dispatchEvent(new CustomEvent('makayasa_sync_update', { detail: { key: CONFIG_KEY } }));
        }
      }
    } catch (err) {
      console.error('Firebase Sync: Error in config listener', err);
    }
  });

  // --- 2. SET UP INTERCEPTORS (CLIENT -> SERVER) ---
  
  // Override localStorage.setItem
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function (key: string, value: string) {
    originalSetItem.apply(this, [key, value]);
    
    if (SYNC_KEYS[key] || key === CONFIG_KEY) {
      syncLocalToServer(key, value);
    }
  };

  // Override localStorage.removeItem
  const originalRemoveItem = localStorage.removeItem;
  localStorage.removeItem = function (key: string) {
    originalRemoveItem.apply(this, [key]);
    
    if (SYNC_KEYS[key] || key === CONFIG_KEY) {
      syncLocalToServer(key, null);
    }
  };

  // --- 3. FORCE INITIAL UPLOAD FOR PRE-EXISTING LOCAL DATA ---
  // If server database is empty, seed it with the current device's local data
  // so the user doesn't lose anything on initial hookup.
  setTimeout(async () => {
    try {
      // Check config
      const serverConfigSnap = await getDocs(collection(db, 'owner_config'));
      if (serverConfigSnap.empty) {
        const localConfigRaw = localStorage.getItem(CONFIG_KEY);
        if (localConfigRaw) {
          console.log('Firebase Sync: Seeding server with local config...');
          await syncLocalToServer(CONFIG_KEY, localConfigRaw);
        }
      }

      // Check lists
      for (const [localKey, collectionName] of Object.entries(SYNC_KEYS)) {
        const serverSnap = await getDocs(collection(db, collectionName));
        if (serverSnap.empty) {
          const localDataRaw = localStorage.getItem(localKey);
          if (localDataRaw && JSON.parse(localDataRaw).length > 0) {
            console.log(`Firebase Sync: Seeding server with local ${collectionName}...`);
            await syncLocalToServer(localKey, localDataRaw);
          }
        }
      }
    } catch (err) {
      console.error('Firebase Sync: Error during initial seed check', err);
    }
  }, 3000);
}
