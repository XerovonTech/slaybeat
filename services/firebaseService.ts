
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
  getFirestore, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  setDoc, 
  doc,
  deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBTBpFjt6QU6LVX23cjRDDNKxgcRK94vok",
  authDomain: "my-music-fighter.firebaseapp.com",
  projectId: "my-music-fighter",
  storageBucket: "my-music-fighter.firebasestorage.app",
  messagingSenderId: "343830171628",
  appId: "1:343830171628:web:fd0745276dea00b2f7fac9",
  measurementId: "G-21N17B13MV"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export interface LeaderboardEntry {
  username: string;
  score: number;
  level: number;
  coins: number;
}

const getPeriodId = () => {
    const HOURS_48 = 48 * 60 * 60 * 1000;
    return Math.floor(Date.now() / HOURS_48).toString();
};

export const firebaseService = {
  async getTopScores(): Promise<LeaderboardEntry[]> {
    try {
      const colName = `leaderboard_p${getPeriodId()}`;
      // Increased limit to 700 as requested
      const q = query(
        collection(db, colName), 
        orderBy("score", "desc"), 
        limit(700)
      );
      const querySnapshot = await getDocs(q);
      const entries: LeaderboardEntry[] = [];
      querySnapshot.forEach((doc) => entries.push(doc.data() as LeaderboardEntry));
      return entries;
    } catch (err) {
      console.warn("Leaderboard fetch failed:", err);
      return [];
    }
  },

  async submitScore(entry: LeaderboardEntry) {
    if (!entry.username || entry.username === 'NewFighter') return;
    try {
      const colName = `leaderboard_p${getPeriodId()}`;
      const playerDoc = doc(db, colName, entry.username);
      await setDoc(playerDoc, {
        ...entry,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Score sync failed:", err);
    }
  },

  async deleteEntry(username: string) {
    try {
      const colName = `leaderboard_p${getPeriodId()}`;
      await deleteDoc(doc(db, colName, username));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }
};
