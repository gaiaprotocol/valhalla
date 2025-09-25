import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging/sw';

const firebaseApp = initializeApp({
  apiKey: 'AIzaSyD21Q4smrSlTxs-FucpGnW2FX_br1rm0HA',
  authDomain: 'gaia-valhalla.firebaseapp.com',
  projectId: 'gaia-valhalla',
  storageBucket: 'gaia-valhalla.firebasestorage.app',
  messagingSenderId: '797829770593',
  appId: '1:797829770593:web:ac557a31562d0c8bd26920',
  measurementId: 'G-GP4SH06LSL'
});

let messaging;
try {
  messaging = getMessaging(firebaseApp);
} catch (err) {
  console.error('Failed to initialize Firebase Messaging', err);
}
