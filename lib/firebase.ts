import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyC-vcQePZRiOUSG0fRnGSmc4s0q0403WJk",
    authDomain: "thanima-jam.firebaseapp.com",
    projectId: "thanima-jam",
    storageBucket: "thanima-jam.firebasestorage.app",
    messagingSenderId: "670560263997",
    appId: "1:670560263997:web:091206bdeb4f270b9bef54",
    measurementId: "G-C73M2PGQ60"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getDatabase(app);

export { db };
