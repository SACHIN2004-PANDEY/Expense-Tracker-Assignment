// Import Firebase
import firebase from "firebase/app"
import "firebase/auth"
import "firebase/firestore"

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
firebase.initializeApp(firebaseConfig)
const auth = firebase.auth()
const db = firebase.firestore()

// ===== Global State =====
let currentUser = null
let allExpenses = []
let filteredExpenses = []
let monthlyBudget = 0

// ===== DOM Elements =====
const logoutBtn = document.getElementById("logoutBtn")
const monthlyBudgetInput = document.getElementById("monthlyBudget")
const budgetWarning = document.getElementById("budgetWarning")

const addExpenseForm = document.getElementById("addExpenseForm")
const expenseDate = document.getElementById("expenseDate")
const expenseCategory = document.getElementById("expenseCategory")
const expenseAmount = document.getElementById("expenseAmount")
const expenseNote = document.getElementById("expenseNote")
const expenseError = document.getElementById("expenseError")
const expenseSuccess = document.getElementById("expenseSuccess")

const filterStartDate = document.getElementById("filterStartDate")
const filterEndDate = document.getElementById("filterEndDate")
const filterCategory = document.getElementById("filterCategory")
const resetFiltersBtn = document.getElementById("resetFilters")

const expensesTableBody = document.getElementById("expensesTableBody")
const totalSpendEl = document.getElementById("totalSpend")
const categoryBreakdownEl = document.getElementById("categoryBreakdown")

// ===== Logout Function =====
function logout() {
  auth.signOut()
}

// ===== Budget Functions =====
function loadBudget() {
  const savedBudget = localStorage.getItem("monthlyBudget")
  if (savedBudget) {
    monthlyBudget = Number.parseFloat(savedBudget)
    monthlyBudgetInput.value = monthlyBudget
  }
}

function saveBudget() {
  monthlyBudget = Number.parseFloat(monthlyBudgetInput.value) || 0
  localStorage.setItem("monthlyBudget", monthlyBudget)
  updateBudgetDisplay(filteredExpenses)
}

function updateBudgetDisplay(expensesList) {
  const { totalSpend } = calculateAnalytics(expensesList)

  if (monthlyBudget > 0 && totalSpend > monthlyBudget) {
    // Over budget - show warning and red text
    totalSpendEl.classList.add("over-budget")
    budgetWarning.style.display = "block"
  } else {
    // Under budget - normal display
    totalSpendEl.classList.remove("over-budget")
    budgetWarning.style.display = "none"
  }
}

// ===== Firestore Functions =====
async function addExpense(date, category, amount, note) {
  if (!currentUser) {
    showError(expenseError, "No user logged in")
    return
  }

  if (!date || !category || !amount) {
    showError(expenseError, "Please fill in all required fields")
    return
  }

  try {
    await db.collection("expenses").add({
      uid: currentUser.uid,
      date: date,
      category: category,
      amount: Number.parseFloat(amount),
      note: note || "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    })

    showSuccess(expenseSuccess, "Expense added successfully!")
    addExpenseForm.reset()
    setDefaultDate()

    // Refresh expenses
    await fetchExpenses()
  } catch (error) {
    showError(expenseError, error.message)
  }
}

async function fetchExpenses() {
  if (!currentUser) return

  try {
    const snapshot = await db
      .collection("expenses")
      .where("uid", "==", currentUser.uid)
      .orderBy("createdAt", "desc")
      .get()

    allExpenses = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    filteredExpenses = [...allExpenses]
    applyFilters()
  } catch (error) {
    console.error("Error fetching expenses:", error)
  }
}

function filterExpenses() {
  const startDate = filterStartDate.value
  const endDate = filterEndDate.value
  const category = filterCategory.value

  filteredExpenses = allExpenses.filter((expense) => {
    let matches = true

    if (startDate && expense.date < startDate) {
      matches = false
    }
    if (endDate && expense.date > endDate) {
      matches = false
    }
    if (category && expense.category !== category) {
      matches = false
    }

    return matches
  })

  renderExpenses(filteredExpenses)
  updateAnalytics(filteredExpenses)
}

function applyFilters() {
  filterExpenses()
}

function resetFiltersHandler() {
  filterStartDate.value = ""
  filterEndDate.value = ""
  filterCategory.value = ""
  filterExpenses()
}

// ===== Analytics Functions =====
function calculateAnalytics(expensesList) {
  if (!expensesList || expensesList.length === 0) {
    return {
      totalSpend: 0,
      categoryBreakdown: {},
    }
  }

  const totalSpend = expensesList.reduce((sum, expense) => sum + expense.amount, 0)

  const categoryBreakdown = expensesList.reduce((breakdown, expense) => {
    if (!breakdown[expense.category]) {
      breakdown[expense.category] = 0
    }
    breakdown[expense.category] += expense.amount
    return breakdown
  }, {})

  return { totalSpend, categoryBreakdown }
}

function updateAnalytics(expensesList) {
  const { totalSpend, categoryBreakdown } = calculateAnalytics(expensesList)

  // Update total spend with Rs
  totalSpendEl.textContent = `₹${totalSpend.toFixed(2)}`

  // Update category breakdown with Rs
  if (Object.keys(categoryBreakdown).length === 0) {
    categoryBreakdownEl.innerHTML = '<p class="empty-state">No expenses yet</p>'
  } else {
    categoryBreakdownEl.innerHTML = Object.entries(categoryBreakdown)
      .map(
        ([category, amount]) =>
          `<div class="breakdown-item">
            <span class="breakdown-category">${category}:</span>
            <span>₹${amount.toFixed(2)}</span>
          </div>`,
      )
      .join("")
  }

  updateBudgetDisplay(expensesList)
}

// ===== Rendering Functions =====
function renderExpenses(expenses) {
  if (expenses.length === 0) {
    expensesTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="4" class="empty-state">No expenses found. Add one to get started!</td>
      </tr>
    `
    return
  }

  expensesTableBody.innerHTML = expenses
    .map((expense) => {
      const categoryClass = `badge-${expense.category.toLowerCase()}`
      const formattedDate = new Date(expense.date).toLocaleDateString()

      return `
        <tr>
          <td>${formattedDate}</td>
          <td><span class="category-badge ${categoryClass}">${expense.category}</span></td>
          <td>${expense.note || "-"}</td>
          <td class="amount">₹${expense.amount.toFixed(2)}</td>
        </tr>
      `
    })
    .join("")
}

// ===== Utility Functions =====
function showError(element, message) {
  element.textContent = message
  element.style.display = "block"
}

function showSuccess(element, message) {
  element.textContent = message
  element.style.display = "block"
  setTimeout(() => {
    element.style.display = "none"
  }, 3000)
}

function setDefaultDate() {
  const today = new Date().toISOString().split("T")[0]
  expenseDate.value = today
}

// ===== Auth State Listener =====
// Redirect to login if not authenticated
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUser = user
    loadBudget()
    setDefaultDate()
    await fetchExpenses()
  } else {
    window.location.href = "login.html"
  }
})

// ===== Event Listeners =====
logoutBtn.addEventListener("click", logout)

monthlyBudgetInput.addEventListener("input", saveBudget)

addExpenseForm.addEventListener("submit", (e) => {
  e.preventDefault()
  addExpense(expenseDate.value, expenseCategory.value, expenseAmount.value, expenseNote.value)
})

filterStartDate.addEventListener("change", filterExpenses)
filterEndDate.addEventListener("change", filterExpenses)
filterCategory.addEventListener("change", filterExpenses)
resetFiltersBtn.addEventListener("click", resetFiltersHandler)

// Initialize
setDefaultDate()
