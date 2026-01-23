import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

// Firebase configuration object
const firebaseConfig = {
  "projectId": "cafeproject-69d9d",
  "appId": "1:944166763222:web:1daf65597fb9a28fbce777",
  "storageBucket": "cafeproject-69d9d.appspot.com",
  "apiKey": "AIzaSyB1J_iMzJLjlGlnOzn0m-c1lrjr0Jt684c",
  "authDomain": "cafeproject-69d9d.firebaseapp.com",
  "messagingSenderId": "944166763222",
  "databaseURL": "https://cafeproject-69d9d-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app, firebaseConfig.databaseURL);
const storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);

export { app, auth, database, storage };
