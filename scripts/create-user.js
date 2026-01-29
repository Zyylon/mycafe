
const admin = require('firebase-admin');
const inquirer = require('inquirer');
const crypto = require('crypto');

// --- START: Configuration ---
// IMPORTANT: Replace with your actual database URL from the Firebase console.
const DATABASE_URL = 'https://cafeproject-69d9d-default-rtdb.asia-southeast1.firebasedatabase.app';
// IMPORTANT: Make sure the `serviceAccountKey.json` file is in your project's root directory.
const serviceAccount = require('../serviceAccountKey.json');
// --- END: Configuration ---


// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: DATABASE_URL,
});

const auth = admin.auth();
const db = admin.database();

/**
 * Hashes a username using SHA256.
 * @param {string} username The username to hash.
 * @returns {string} The hexadecimal hash digest.
 */
const hashUsername = (username) => {
  return crypto.createHash('sha256').update(username.toLowerCase()).digest('hex');
};

/**
 * The main function to create a user.
 */
const createUser = async () => {
  try {
    console.log('--- Advanced User Creation Tool ---');
    
    // 1. Prompt for user details
    const answers = await inquirer.prompt([
      { name: 'email', message: 'Enter user email:', validate: input => input.includes('@') },
      { name: 'password', message: 'Enter user password (min. 6 characters):', type: 'password', validate: input => input.length >= 6 },
      { name: 'username', message: 'Enter username:', validate: input => input.length > 0 },
      { name: 'role', message: 'Select user role:', type: 'list', choices: ['staff', 'admin', 'superadmin'] },
    ]);

    const { email, password, username, role } = answers;

    console.log(`\nProcessing new user: ${username} (${email})`);

    // 2. Create user in Firebase Authentication
    console.log('Step 1: Creating user in Firebase Authentication...');
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: username,
    });
    console.log(` -> Success! Auth user created with UID: ${userRecord.uid}`);

    // 3. Create user record in Realtime Database and the username map
    console.log('Step 2: Creating user record in Realtime Database...');
    const hashedUsername = hashUsername(username);
    
    const updates = {};
    updates[`/users/${userRecord.uid}`] = {
      email: email.toLowerCase(),
      username: username,
      role: role,
      createdAt: admin.database.ServerValue.TIMESTAMP,
    };
    updates[`/username_map/${hashedUsername}`] = email.toLowerCase();
    
    await db.ref().update(updates);
    console.log(' -> Success! Database records created and synced.');

    console.log('\n✅ All Done! User has been created successfully.');

  } catch (error) {
    console.error('\n❌ Error during user creation:');
    if (error.code === 'auth/email-already-exists') {
      console.error(' -> This email address is already in use by another account.');
    } else if (error.code === 'auth/invalid-password') {
      console.error(' -> The password is not valid. It must be at least 6 characters long.');
    } else {
      console.error(' -> An unexpected error occurred:', error.message);
    }
    console.log('Please try again.');
  }
};

// Run the script
createUser();
