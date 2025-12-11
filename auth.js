
const auth = firebase.auth()

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
  e.preventDefault();
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();

  if (!email || !password) {
    showError(authError, "Please fill in all fields");
    return;
  }

  try {
    if (isLoginMode) {
      // UPDATED syntax for compat library
      await auth.signInWithEmailAndPassword(email, password);
    } else {
      // UPDATED syntax for compat library
      await auth.createUserWithEmailAndPassword(email, password);
    }
    authForm.reset();
    authError.style.display = "none";
  } catch (error) {
    showError(authError, error.message);
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
