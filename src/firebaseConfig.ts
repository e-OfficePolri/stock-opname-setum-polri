// Import fungsi yang diperlukan dari SDK Firebase
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// TODO: Ganti nilai di bawah ini dengan kredensial dari Project Firebase Anda
const firebaseConfig = {
  apiKey: "AIzaSyDY5UydwIhQlNkMYgc4GNsFUefYy5Di8_8",
  authDomain: "stock-opname-setum-polri-d1871.firebaseapp.com",
  projectId: "stock-opname-setum-polri-d1871",
  storageBucket: "stock-opname-setum-polri-d1871.firebasestorage.app",
  messagingSenderId: "266473667726",
  appId: "1:266473667726:web:23dcc9141dfa32a4c41ddf"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// Inisialisasi Firestore Database
export const db = getFirestore(app);