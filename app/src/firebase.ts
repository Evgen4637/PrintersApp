import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDzOHJpKI-UcvTteLbLgs8_wiNLQvdCkfE",
  authDomain: "printersapp-545bb.firebaseapp.com",
  projectId: "printersapp-545bb",
  storageBucket: "printersapp-545bb.firebasestorage.app",
  messagingSenderId: "119571747159",
  appId: "1:119571747159:web:51d58d2b668661b210ee12"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
