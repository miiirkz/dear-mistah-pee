import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCTlXfnKgFN0VbxtfSsPRkpGKsz53UIfoQ",
  authDomain: "dear-mistah-pee.firebaseapp.com",
  projectId: "dear-mistah-pee",
  storageBucket: "dear-mistah-pee.firebasestorage.app",
  messagingSenderId: "117833056276",
  appId: "1:117833056276:web:effbea4660493fcedba701"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
