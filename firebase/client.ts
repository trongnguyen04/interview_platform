// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from 'firebase/firestore';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDC9qk0QhDoOL-93nWyJXUDfWESzQXO6Fw",
  authDomain: "prepwise-d3558.firebaseapp.com",
  projectId: "prepwise-d3558",
  storageBucket: "prepwise-d3558.firebasestorage.app",
  messagingSenderId: "307771776670",
  appId: "1:307771776670:web:256b0f3e89941c1855258f",
  measurementId: "G-0MYYGD6XCZ"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
