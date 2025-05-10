import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, push, onValue, remove } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBw2pnFKewLD742QlyLYHVnX57t-lqMQXU",
  authDomain: "clip-10953.firebaseapp.com",
  databaseURL: "https://clip-10953-default-rtdb.firebaseio.com",
  projectId: "clip-10953",
  storageBucket: "clip-10953.firebasestorage.app",
  messagingSenderId: "651247417980",
  appId: "1:651247417980:web:fde41276745c88009ea7f9",
  measurementId: "G-V291PV57E8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Folder service functions
export const createFolder = async (folderName: string) => {
  try {
    const foldersRef = ref(database, 'folders');
    const newFolderRef = push(foldersRef);
    await set(newFolderRef, {
      name: folderName,
      createdAt: new Date().toISOString()
    });
    return newFolderRef.key;
  } catch (error) {
    console.error("Error creating folder:", error);
    throw error;
  }
};

export const getFolders = (callback: (folders: any[]) => void) => {
  const foldersRef = ref(database, 'folders');
  return onValue(foldersRef, (snapshot) => {
    const data = snapshot.val();
    const folderList = data ? Object.keys(data).map(key => ({
      id: key,
      ...data[key]
    })) : [];
    callback(folderList);
  });
};

export const deleteFolder = async (folderId: string) => {
  try {
    const folderRef = ref(database, `folders/${folderId}`);
    await remove(folderRef);
  } catch (error) {
    console.error("Error deleting folder:", error);
    throw error;
  }
};

export default {
  app,
  database,
  createFolder,
  getFolders,
  deleteFolder
}; 