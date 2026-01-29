
const admin = require('firebase-admin');
const inquirer = require('inquirer');

// --- START: Configuration ---
const DATABASE_URL = 'https://cafeproject-69d9d-default-rtdb.asia-southeast1.firebasedatabase.app';
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
 * Fetches all users from Firebase Authentication.
 * @returns {Map<string, admin.auth.UserRecord>} A map of UID to UserRecord.
 */
const getAllAuthUsers = async () => {
  const userMap = new Map();
  let nextPageToken;
  do {
    const listUsersResult = await auth.listUsers(1000, nextPageToken);
    listUsersResult.users.forEach(userRecord => {
      userMap.set(userRecord.uid, userRecord);
    });
    nextPageToken = listUsersResult.pageToken;
  } while (nextPageToken);
  return userMap;
};

/**
 * Fetches all user records from the Realtime Database.
 * @returns {Map<string, object>} A map of UID to the user data object.
 */
const getAllDbUsers = async () => {
  const snapshot = await db.ref('/users').once('value');
  const dbUsers = snapshot.val() || {};
  return new Map(Object.entries(dbUsers));
};

/**
 * The main synchronization function.
 */
const syncUsers = async () => {
  try {
    console.log('--- User & Database Sync Tool ---\n');
    
    // 1. Fetch all users from both sources
    console.log('Fetching users from Firebase Authentication...');
    const authUserMap = await getAllAuthUsers();
    console.log(` -> Found ${authUserMap.size} users in Auth.`);

    console.log('Fetching user records from Realtime Database...');
    const dbUserMap = await getAllDbUsers();
    console.log(` -> Found ${dbUserMap.size} records in DB.`);

    // 2. Find Auth users missing from the database
    const missingInDb = [];
    for (const [uid, authUser] of authUserMap.entries()) {
      if (!dbUserMap.has(uid)) {
        missingInDb.push(authUser);
      }
    }

    // 3. Find orphaned database records
    const orphanedInDb = [];
    for (const uid of dbUserMap.keys()) {
      if (!authUserMap.has(uid)) {
        orphanedInDb.push(uid);
      }
    }

    console.log('\n--- Sync Analysis Complete ---');
    console.log(`Found ${missingInDb.length} Auth users missing a DB record.`);
    console.log(`Found ${orphanedInDb.length} orphaned DB records without an Auth user.\n`);

    // 4. Interactively fix users missing from DB
    if (missingInDb.length > 0) {
      const { confirmCreate } = await inquirer.prompt([
        { name: 'confirmCreate', type: 'confirm', message: `Do you want to create missing records for these ${missingInDb.length} users in the database?` },
      ]);

      if (confirmCreate) {
        const updates = {};
        for (const user of missingInDb) {
          console.log(` -> Preparing DB record for: ${user.email} (UID: ${user.uid})`);
          updates[`/users/${user.uid}`] = {
            email: user.email.toLowerCase(),
            role: 'staff', // Assign a default role
            username: user.displayName || 'N/A',
            createdAt: admin.database.ServerValue.TIMESTAMP,
            syncedAt: admin.database.ServerValue.TIMESTAMP,
          };
        }
        await db.ref().update(updates);
        console.log(`\n✅ Successfully created ${missingInDb.length} missing database records.`);
      }
    }

    // 5. Interactively clean up orphaned DB records
    if (orphanedInDb.length > 0) {
      const { confirmDelete } = await inquirer.prompt([
        { name: 'confirmDelete', type: 'confirm', message: `Do you want to DELETE ${orphanedInDb.length} orphaned records from the database? This cannot be undone.` },
      ]);

      if (confirmDelete) {
        const updates = {};
        for (const uid of orphanedInDb) {
          console.log(` -> Marking for deletion: Orphaned record with UID: ${uid}`);
          updates[`/users/${uid}`] = null; // Setting to null deletes the record
        }
        await db.ref().update(updates);
        console.log(`\n✅ Successfully deleted ${orphanedInDb.length} orphaned database records.`);
      }
    }

    if (missingInDb.length === 0 && orphanedInDb.length === 0) {
        console.log('✨ All users are perfectly in sync!');
    }

    console.log('\n--- Sync Process Finished ---');

  } catch (error) {
    console.error('\n❌ An error occurred during the sync process:', error);
  }
};

// Run the script
syncUsers();
