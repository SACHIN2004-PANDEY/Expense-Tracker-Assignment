// dashboard.js

// ===== Global State =====
let currentUser = null;
let allExpenses = [];
let filteredExpenses = [];
let monthlyBudget = 0;
let unsubscribeExpenses = null; // Store the listener to stop it later
let categoryChart = null;
let trendChart = null;
let currentTrendView = 'weekly'; // 'weekly' or 'monthly'

// ===== DOM Elements =====
const logoutBtn = document.getElementById("logoutBtn");
const monthlyBudgetInput = document.getElementById("monthlyBudget");
const budgetWarning = document.getElementById("budgetWarning");

const addExpenseForm = document.getElementById("addExpenseForm");
const expenseDate = document.getElementById("expenseDate");
const expenseCategory = document.getElementById("expenseCategory");
const expenseAmount = document.getElementById("expenseAmount");
const expenseNote = document.getElementById("expenseNote");
const expenseError = document.getElementById("expenseError");
const expenseSuccess = document.getElementById("expenseSuccess");

const filterStartDate = document.getElementById("filterStartDate");
const filterEndDate = document.getElementById("filterEndDate");
const filterCategory = document.getElementById("filterCategory");
const resetFiltersBtn = document.getElementById("resetFilters");

const expensesTableBody = document.getElementById("expensesTableBody");
const totalSpendEl = document.getElementById("totalSpend");
const categoryBreakdownEl = document.getElementById("categoryBreakdown");

// ===== Logout Function =====
function logout() {
  // Stop listening to updates when logging out
  if (unsubscribeExpenses) {
    unsubscribeExpenses();
  }
  auth.signOut().then(() => {
    window.location.href = "index.html";
  });
}

// ===== Budget Functions =====
// Updated loadBudget function
async function loadBudget() {
  if (!currentUser) return;

  try {
    const userDoc = await db.collection("users").doc(currentUser.uid).get();
    
    if (userDoc.exists && userDoc.data().monthlyBudget) {
      monthlyBudget = userDoc.data().monthlyBudget;
      monthlyBudgetInput.value = monthlyBudget;
    } else {
      // Default to 0 if no budget is set
      monthlyBudget = 0;
      monthlyBudgetInput.value = "";
    }
    
    // Re-calculate display in case expenses loaded before budget
    updateBudgetDisplay(filteredExpenses);
    
  } catch (error) {
    console.error("Error loading budget:", error);
  }
}

async function saveBudget() {
  const newBudget = parseFloat(monthlyBudgetInput.value) || 0;
  
  // Update local state immediately for better UI responsiveness
  monthlyBudget = newBudget;
  updateBudgetDisplay(filteredExpenses);

  if (currentUser) {
    try {
      await db.collection("users").doc(currentUser.uid).set({
        monthlyBudget: newBudget
      }, { merge: true }); // merge: true ensures we don't overwrite other potential fields
      console.log("Budget saved to Firebase");
    } catch (error) {
      console.error("Error saving budget:", error);
      alert("Failed to save budget to server.");
    }
  }
}

function updateBudgetDisplay(expensesList) {
  const { totalSpend } = calculateAnalytics(expensesList);

  if (monthlyBudget > 0 && totalSpend > monthlyBudget) {
    totalSpendEl.classList.add("over-budget");
    budgetWarning.style.display = "block";
    budgetWarning.textContent = `Warning: You have exceeded your budget of ₹${monthlyBudget}!`;
  } else {
    totalSpendEl.classList.remove("over-budget");
    budgetWarning.style.display = "none";
  }
}

// ===== Firestore Functions =====

// 1. ADD EXPENSE (Writes to DB)
async function addExpense(date, category, amount, note) {
  if (!currentUser) {
    showError(expenseError, "No user logged in");
    return;
  }

  if (!date || !category || !amount) {
    showError(expenseError, "Please fill in all required fields");
    return;
  }

  const submitBtn = addExpenseForm.querySelector("button[type='submit']");
  submitBtn.disabled = true;
  submitBtn.textContent = "Adding...";

  try {
    await db.collection("expenses").add({
      uid: currentUser.uid,
      date: date,
      category: category,
      amount: parseFloat(amount),
      note: note || "",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    showSuccess(expenseSuccess, "Expense added successfully!");
    addExpenseForm.reset();
    setDefaultDate();
    
    // NOTE: We do NOT need to call fetchExpenses() manually anymore.
    // The onSnapshot listener below will detect the change automatically.

  } catch (error) {
    console.error("Error adding expense:", error);
    showError(expenseError, error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Add Expense";
  }
}

// 2. LISTEN FOR EXPENSES (Reads from DB in Real-time)
function setupRealtimeListener() {
  if (!currentUser) return;

  // Unsubscribe from previous listener if it exists
  if (unsubscribeExpenses) {
    unsubscribeExpenses();
  }

  // Create a query
  const q = db.collection("expenses")
    .where("uid", "==", currentUser.uid)
    .orderBy("date", "desc");

  // onSnapshot sets up the continuous listener
  unsubscribeExpenses = q.onSnapshot((snapshot) => {
    allExpenses = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Update UI whenever data changes
    filteredExpenses = [...allExpenses];
    applyFilters();
  }, (error) => {
    console.error("Error listening to expenses:", error);
    // This usually triggers if the Index is missing
    if (error.code === 'failed-precondition') {
        console.log("INDEX MISSING: Check the console link to create it.");
    }
  });
}

function filterExpenses() {
  const startDate = filterStartDate.value;
  const endDate = filterEndDate.value;
  const category = filterCategory.value;

  filteredExpenses = allExpenses.filter((expense) => {
    let matches = true;

    if (startDate && expense.date < startDate) matches = false;
    if (endDate && expense.date > endDate) matches = false;
    if (category && expense.category !== category) matches = false;

    return matches;
  });

  renderExpenses(filteredExpenses);
  updateAnalytics(filteredExpenses);
}

function applyFilters() {
  filterExpenses();
}

function resetFiltersHandler() {
  filterStartDate.value = "";
  filterEndDate.value = "";
  filterCategory.value = "";
  filterExpenses();
}

// ===== Analytics Functions =====
function calculateAnalytics(expensesList) {
  if (!expensesList || expensesList.length === 0) {
    return {
      totalSpend: 0,
      categoryBreakdown: {},
    };
  }

  const totalSpend = expensesList.reduce((sum, expense) => sum + expense.amount, 0);

  const categoryBreakdown = expensesList.reduce((breakdown, expense) => {
    if (!breakdown[expense.category]) {
      breakdown[expense.category] = 0;
    }
    breakdown[expense.category] += expense.amount;
    return breakdown;
  }, {});

  return { totalSpend, categoryBreakdown };
}

function updateAnalytics(expensesList) {
  const { totalSpend, categoryBreakdown } = calculateAnalytics(expensesList);

  totalSpendEl.textContent = `₹${totalSpend.toFixed(2)}`;

  // --- UPDATE LIST (Existing Code) ---
  if (Object.keys(categoryBreakdown).length === 0) {
    categoryBreakdownEl.innerHTML = '<p class="empty-state">No expenses yet</p>';
    // Optional: Clear chart if no data
    if (categoryChart) {
        categoryChart.destroy();
        categoryChart = null;
    }
  } else {
    categoryBreakdownEl.innerHTML = Object.entries(categoryBreakdown)
      .map(
        ([category, amount]) =>
          `<div class="breakdown-item">
            <span class="breakdown-category">${category}:</span>
            <span>₹${amount.toFixed(2)}</span>
          </div>`
      )
      .join("");
      
    // --- NEW: RENDER CHART ---
    renderChart(categoryBreakdown);
    renderTrendChart(expensesList); // <--- Add this line
  }

  updateBudgetDisplay(expensesList);
}

// ===== Rendering Functions =====
function renderExpenses(expenses) {
  if (expenses.length === 0) {
    expensesTableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="4" class="empty-state">No expenses found. Add one to get started!</td>
      </tr>
    `;
    return;
  }

  expensesTableBody.innerHTML = expenses
    .map((expense) => {
      const categoryClass = `badge-${expense.category.toLowerCase()}`;
      // Formatting date: YYYY-MM-DD -> DD/MM/YYYY
      const dateParts = expense.date.split("-");
      const displayDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`; 

      return `
        <tr>
          <td>${displayDate}</td>
          <td><span class="category-badge ${categoryClass}">${expense.category}</span></td>
          <td>${expense.note || "-"}</td>
          <td class="amount">₹${expense.amount.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");
}

// ===== Utility Functions =====
function showError(element, message) {
  element.textContent = message;
  element.style.display = "block";
  setTimeout(() => {
    element.style.display = "none";
  }, 5000);
}

function showSuccess(element, message) {
  element.textContent = message;
  element.style.display = "block";
  setTimeout(() => {
    element.style.display = "none";
  }, 3000);
}

function setDefaultDate() {
  const today = new Date().toISOString().split("T")[0];
  expenseDate.value = today;
}

function renderChart(breakdown) {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  
  // Extract labels (categories) and data (amounts)
  const labels = Object.keys(breakdown);
  const data = Object.values(breakdown);

  // Define colors for your categories matching your CSS badges if possible
  const backgroundColors = [
    '#FF6384', // Redish
    '#36A2EB', // Blue
    '#FFCE56', // Yellow
    '#4BC0C0', // Teal
    '#9966FF', // Purple
    '#FF9F40'  // Orange
  ];

  // If a chart instance already exists, destroy it before creating a new one
  if (categoryChart) {
    categoryChart.destroy();
  }

  // Create new Chart
  categoryChart = new Chart(ctx, {
    type: 'doughnut', // You can change this to 'pie' if you prefer a full circle
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColors,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
        }
      }
    }
  });
}

// Helper: Get the start of the week (Monday) for a given date string
function getStartOfWeek(dateString) {
  const d = new Date(dateString);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0]; // Returns YYYY-MM-DD
}

// Helper: Get Month key (YYYY-MM)
function getMonthKey(dateString) {
  return dateString.substring(0, 7); // Returns YYYY-MM
}

function renderTrendChart(expenses) {
  const ctx = document.getElementById('trendChart').getContext('2d');
  
  // 1. Group Data
  const groupedData = {};
  
  // Sort expenses by date ascending (oldest first) for the line chart
  const sortedExpenses = [...expenses].sort((a, b) => new Date(a.date) - new Date(b.date));

  sortedExpenses.forEach(expense => {
    let key;
    if (currentTrendView === 'weekly') {
      key = getStartOfWeek(expense.date); // Key: "2023-10-23"
    } else {
      key = getMonthKey(expense.date);    // Key: "2023-10"
    }
    
    if (!groupedData[key]) groupedData[key] = 0;
    groupedData[key] += expense.amount;
  });

  const labels = Object.keys(groupedData);
  const dataPoints = Object.values(groupedData);

  // 2. Format Labels for Display (Optional: Make them prettier)
  const displayLabels = labels.map(label => {
    const d = new Date(label);
    if (currentTrendView === 'weekly') {
      return `Week of ${d.getDate()}/${d.getMonth() + 1}`;
    } else {
      return d.toLocaleString('default', { month: 'short', year: 'numeric' });
    }
  });

  // 3. Destroy old chart
  if (trendChart) {
    trendChart.destroy();
  }

  // 4. Create Chart
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: displayLabels,
      datasets: [{
        label: currentTrendView === 'weekly' ? 'Weekly Spend' : 'Monthly Spend',
        data: dataPoints,
        borderColor: '#7033ff', // Your primary color
        backgroundColor: 'rgba(112, 51, 255, 0.1)',
        borderWidth: 2,
        tension: 0.3, // Makes line slightly curved
        fill: true,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#7033ff',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `₹${context.raw.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { borderDash: [2, 4], color: '#e5e7eb' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}
// ===== Auth State Listener =====
// ===== Auth State Listener =====
auth.onAuthStateChanged((user) => {
  if (user) {
    currentUser = user;
    loadBudget(); // <--- This now fetches from Firebase
    setDefaultDate();
    setupRealtimeListener();
  } else {
    if (unsubscribeExpenses) unsubscribeExpenses();
    window.location.href = "index.html";
  }
});

const showWeeklyBtn = document.getElementById("showWeeklyBtn");
const showMonthlyBtn = document.getElementById("showMonthlyBtn");

showWeeklyBtn.addEventListener("click", () => {
  if (currentTrendView === 'weekly') return; // Do nothing if already active
  
  currentTrendView = 'weekly';
  
  // Toggle UI classes
  showWeeklyBtn.classList.add("active");
  showMonthlyBtn.classList.remove("active");
  
  // Re-render chart with current data
  renderTrendChart(filteredExpenses);
});

showMonthlyBtn.addEventListener("click", () => {
  if (currentTrendView === 'monthly') return;
  
  currentTrendView = 'monthly';
  
  // Toggle UI classes
  showMonthlyBtn.classList.add("active");
  showWeeklyBtn.classList.remove("active");
  
  renderTrendChart(filteredExpenses);
});

// ===== Event Listeners =====
logoutBtn.addEventListener("click", logout);
monthlyBudgetInput.addEventListener("input", saveBudget);

addExpenseForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addExpense(expenseDate.value, expenseCategory.value, expenseAmount.value, expenseNote.value);
});

filterStartDate.addEventListener("change", filterExpenses);
filterEndDate.addEventListener("change", filterExpenses);
filterCategory.addEventListener("change", filterExpenses);
resetFiltersBtn.addEventListener("click", resetFiltersHandler);