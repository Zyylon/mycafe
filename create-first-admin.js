require('firebase/auth');
require('firebase/database');
const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');
const { getDatabase, ref, set } = require('firebase/database');

const firebaseConfig = {
  "projectId": "cafeproject-69d9d",
  "appId": "1:944166763222:web:1daf65597fb9a28fbce777",
  "storageBucket": "cafeproject-69d9d.appspot.com",
  "apiKey": "AIzaSyB1J_iMzJLjlGlnOzn0m-c1lrjr0Jt684c",
  "authDomain": "cafeproject-69d9d.firebaseapp.com",
  "messagingSenderId": "944166763222",
  "databaseURL": "https://cafeproject-69d9d-default-rtdb.asia-southeast1.firebasedatabase.app"
};

async function createAdmin() {
  try {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const database = getDatabase(app);

    const email = 'wtahir999@gmail.com';
    const password = 'TempPassword123!';
    const username = 'superadmin';

    // Create the user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const { uid } = userCredential.user;

    // Save user info in Realtime Database
    await set(ref(database, `users/${uid}`), {
      username,
      email,
      role: 'admin',
      createdAt: new Date().toISOString(),
    });

    console.log('Admin user created successfully!');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error.message);
    process.exit(1);
  }
}

createAdmin();
