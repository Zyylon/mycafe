const admin = require('firebase-admin');

// --- START: Configuration ---

const DATABASE_URL = 'https://cafeproject-69d9d-default-rtdb.asia-southeast1.firebasedatabase.app';
const serviceAccount = require('../serviceAccountKey.json');
// --- END: Configuration ---


// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: DATABASE_URL,
});

const db = admin.database();

const getMenuItems = async () => {
  try {
    console.log('--- Debug Menu Items ---');
    console.log('Fetching menu items from the database...');
    const snapshot = await db.ref('/menu_items').once('value');
    const menuItems = snapshot.val();
    console.log('--- Menu Items Data ---');
    console.log(JSON.stringify(menuItems, null, 2));
    console.log('--- End of Menu Items Data ---');
  } catch (error) {
    console.error('An error occurred while fetching menu items:', error);
  }
};

getMenuItems().finally(() => {
  // Close the database connection to allow the script to exit.
  db.goOffline();
});