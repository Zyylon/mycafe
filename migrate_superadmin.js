
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, set } = require("firebase/database");

const firebaseConfig = {
  "projectId": "cafeproject-69d9d",
  "appId": "1:944166763222:web:1daf65597fb9a28fbce777",
  "storageBucket": "cafeproject-69d9d.appspot.com",
  "apiKey": "AIzaSyB1J_iMzJLjlGlnOzn0m-c1lrjr0Jt684c",
  "authDomain": "cafeproject-69d9d.firebaseapp.com",
  "messagingSenderId": "944166763222",
  "databaseURL": "https://cafeproject-69d9d-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const HASHED_USERNAME = "186cf774c97b60a1c106ef718d10970a6a06e06bef89553d9ae65d938a886eae";
const USER_EMAIL = "wtahir999@gmail.com";

async function migrate() {
  try {
    const mapRef = ref(database, `username_map/${HASHED_USERNAME}`);
    await set(mapRef, USER_EMAIL);
    console.log("Migration successful! The superadmin user can now log in.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    process.exit(0);
  }
}

migrate();
