const firebaseConfig = {
  apiKey: "AIzaSyDnT_UF2oOUeMoLTtCKNqRyPzo-FCVzU14",
  authDomain: "expense-tracker-54838.firebaseapp.com",
  projectId: "expense-tracker-54838",
  storageBucket: "expense-tracker-54838.firebasestorage.app",
  messagingSenderId: "426799981032",
  appId: "1:426799981032:web:03bce53623793de76f845d"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();