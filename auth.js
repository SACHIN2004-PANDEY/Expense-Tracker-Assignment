// Import Firebase modules
import { initializeApp } from "firebase/app"
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth"

// ===== Firebase Configuration =====
// IMPORTANT: Replace with your Firebase config from Firebase Console
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
}

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig)
const auth = getAuth(firebaseApp)

// ===== Global State =====
let isLoginMode = true

// ===== DOM Elements =====
const authForm = document.getElementById("authForm")
const authButton = document.getElementById("authButton")
const authEmail = document.getElementById("authEmail")
const authPassword = document.getElementById("authPassword")
const toggleAuthModeBtn = document.getElementById("toggleAuthMode")
const toggleText = document.getElementById("toggleText")
const authError = document.getElementById("authError")

// ===== Authentication Functions =====
function toggleAuthMode() {
  isLoginMode = !isLoginMode
  authButton.textContent = isLoginMode ? "Login" : "Register"
  toggleText.textContent = isLoginMode ? "Don't have an account?" : "Already have an account?"
  authForm.reset()
  authError.style.display = "none"
}

async function handleAuth(e) {
  e.preventDefault()
  const email = authEmail.value.trim()
  const password = authPassword.value.trim()

  if (!email || !password) {
    showError(authError, "Please fill in all fields")
    return
  }

  try {
    if (isLoginMode) {
      await signInWithEmailAndPassword(auth, email, password)
    } else {
      await createUserWithEmailAndPassword(auth, email, password)
    }
    authForm.reset()
    authError.style.display = "none"
  } catch (error) {
    showError(authError, error.message)
  }
}

// ===== Utility Functions =====
function showError(element, message) {
  element.textContent = message
  element.style.display = "block"
}

// ===== Auth State Listener =====
// Redirect to dashboard if logged in
auth.onAuthStateChanged((user) => {
  if (user) {
    window.location.href = "dashboard.html"
  }
})

// ===== Event Listeners =====
authForm.addEventListener("submit", handleAuth)
toggleAuthModeBtn.addEventListener("click", toggleAuthMode)
