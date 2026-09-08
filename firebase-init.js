// ============================================================
// CARLOS CRUZ — FIREBASE INIT
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getDatabase, ref, onValue, push, set, update, remove, get, runTransaction, child
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5B1A7fcnBoNEE2J4wPf5k2SVyI_RyoWY",
  authDomain: "carlos-cruz-shop.firebaseapp.com",
  databaseURL: "https://carlos-cruz-shop-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "carlos-cruz-shop",
  storageBucket: "carlos-cruz-shop.firebasestorage.app",
  messagingSenderId: "282860021863",
  appId: "1:282860021863:web:9da9ea092600a510148cc2"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, onValue, push, set, update, remove, get, runTransaction, child };

// ============================================================
// CLOUDINARY — popuni CLOUD_NAME pre puštanja sajta uživo
// ============================================================
// Preset "CarlosCruzShop" (unsigned, asset folder "shop") je već napravljen.
// Cloud name nije bio u prosleđenim screenshotovima — upiši ga ovde:
export const CLOUDINARY_CLOUD_NAME = "h7mo1ctt";
export const CLOUDINARY_UPLOAD_PRESET = "CarlosCruzShop";
