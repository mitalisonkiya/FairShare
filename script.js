/* script.js — FairShare Core Engine (Hardened & Local-First Architecture) */

/* Storage keys */
const USERS_KEY = "fs_users";
const CURRENT_KEY = "fs_currentUser";
const GROUPS_KEY = "fs_groups";
const ACTIVE_KEY = "fs_activeGroup";
const AUTH_TOKEN_KEY = "fs_auth_token";

/* --- Notification System --- */
function showToast(msg, isError = false) {
  let box = document.getElementById("toastContainer");
  if (!box) {
    box = document.createElement("div");
    box.id = "toastContainer";
    document.body.appendChild(box);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${isError ? 'error' : ''}`;
  toast.innerHTML = `<span style="color:${isError ? 'var(--signal-coral)' : 'var(--signal-green)'}">${isError ? '✕' : '✓'}</span> <span>${escapeHtml(msg)}</span>`;
  box.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* --- Cryptographic Helpers --- */
async function hashPasswordSHA256(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "_fairshare_salt_v2");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/* --- Storage & Utilities --- */
function getUsers() { 
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; } catch(e) { return []; } 
}
function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }
function setCurrentUser(email) { localStorage.setItem(CURRENT_KEY, email); }
function getCurrentUser() { return localStorage.getItem(CURRENT_KEY); }
function logout() { 
  localStorage.removeItem(CURRENT_KEY); 
  localStorage.removeItem("user");
  localStorage.removeItem(AUTH_TOKEN_KEY);
  window.location.href = "login.html"; 
}

function getGroups() { 
  try { return JSON.parse(localStorage.getItem(GROUPS_KEY)) || []; } catch(e) { return []; } 
}
function saveGroups(g) { localStorage.setItem(GROUPS_KEY, JSON.stringify(g)); }

function setActiveGroupId(id) { localStorage.setItem(ACTIVE_KEY, id); }
function getActiveGroupId() { return localStorage.getItem(ACTIVE_KEY); }

// Robust HTML escaping to prevent XSS
function escapeHtml(str) { 
  if (str === null || str === undefined) return ""; 
  return String(str).replace(/[&<>"'`=\/]/g, s => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '`': '&#96;',
    '=': '&#61;',
    '/': '&#47;'
  }[s])); 
}

function getUserName(email) { 
  if (!email) return "Anonymous";
  const u = getUsers().find(x => x.email.toLowerCase() === email.toLowerCase()); 
  return u ? u.name : email; 
}

function requireAuthRedirect() { 
  if (!getCurrentUser()) { 
    window.location.href = "login.html"; 
    return false; 
  } 
  return true; 
}

/* --- Auth Handlers (Hardened) --- */
async function signupUser() {
  const nameEl = document.getElementById("su_name");
  const emailEl = document.getElementById("su_email");
  const passEl = document.getElementById("su_password");
  const pass2El = document.getElementById("su_password2");
  
  const name = nameEl?.value?.trim();
  const email = emailEl?.value?.trim().toLowerCase();
  const pass = passEl?.value;
  const pass2 = pass2El?.value;
  
  if (!name || !email || !pass || !pass2) { showToast("Please fill all required fields", true); return; }
  
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) { showToast("Please enter a valid email address", true); return; }
  
  // Enforce minimum 10 characters password
  if (pass.length < 10) { showToast("Password must be at least 10 characters", true); return; }
  if (pass !== pass2) { showToast("Passwords do not match", true); return; }
  
  const users = getUsers();
  if (users.some(u => u.email.toLowerCase() === email)) { 
    showToast("An account with this email already exists", true); 
    return; 
  }
  
  // Hash password with SHA-256 before local persistence
  const passwordHash = await hashPasswordSHA256(pass);
  const newUser = { name, email, passwordHash, created: Date.now() };
  users.push(newUser);
  saveUsers(users);
  
  setCurrentUser(email);
  localStorage.setItem("user", JSON.stringify({ name, email }));
  showToast("Account created successfully!");
  setTimeout(() => window.location.href = "dashboard.html", 400);
}

async function loginUser() {
  const emailEl = document.getElementById("li_email");
  const passEl = document.getElementById("li_password");
  
  const email = emailEl?.value?.trim().toLowerCase();
  const pass = passEl?.value;
  
  if (!email || !pass) { showToast("Please enter email and password", true); return; }
  
  const users = getUsers();
  const user = users.find(u => u.email.toLowerCase() === email);
  
  // Unified error message for security (prevent email enumeration)
  const invalidMsg = "Invalid email or password";
  
  if (!user) { 
    showToast(invalidMsg, true); 
    return; 
  }
  
  const inputHash = await hashPasswordSHA256(pass);
  const isMatch = user.passwordHash ? (user.passwordHash === inputHash) : (user.password === pass);
  
  if (!isMatch) { 
    showToast(invalidMsg, true); 
    return; 
  }
  
  // If user had legacy plaintext password, upgrade to hash
  if (user.password && !user.passwordHash) {
    user.passwordHash = inputHash;
    delete user.password;
    saveUsers(users);
  }
  
  setCurrentUser(email);
  localStorage.setItem("user", JSON.stringify({ name: user.name, email: user.email }));
  showToast("Login successful!");
  setTimeout(() => window.location.href = "dashboard.html", 400);
}

/* --- Password Reset Handlers (15-Minute Expiry) --- */
function startPasswordReset() {
  const email = (document.getElementById("fp_email") || {}).value?.trim().toLowerCase();
  if (!email) { showToast("Please enter registered email", true); return; }
  
  const users = getUsers(); 
  const idx = users.findIndex(u => u.email.toLowerCase() === email);
  
  // Unified response to prevent account enumeration
  if (idx === -1) { 
    showToast("If an account exists, reset instructions are prepared."); 
    return; 
  }
  
  const resetToken = "rst_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
  const resetExpires = Date.now() + (15 * 60 * 1000); // 15 mins expiry
  
  users[idx].resetToken = resetToken;
  users[idx].resetExpires = resetExpires;
  saveUsers(users);
  
  document.getElementById("fp_status").innerText = `Account verified. Enter your new password (valid for 15 minutes).`;
  document.getElementById("fp_new_pw_area").style.display = "block";
  document.getElementById("fp_index").value = resetToken;
}

async function finalizePasswordReset() {
  const token = document.getElementById("fp_index")?.value;
  const np = (document.getElementById("fp_new_password") || {}).value;
  const np2 = (document.getElementById("fp_new_password2") || {}).value;
  
  if (!token) { showToast("Invalid reset session", true); return; }
  if (!np || !np2) { showToast("Please enter new passwords", true); return; }
  if (np.length < 10) { showToast("New password must be at least 10 characters", true); return; }
  if (np !== np2) { showToast("Passwords do not match", true); return; }
  
  const users = getUsers(); 
  const user = users.find(u => u.resetToken === token && u.resetExpires > Date.now());
  
  if (!user) {
    showToast("Reset session has expired or is invalid. Please request a new reset.", true);
    return;
  }
  
  // Hash new password and invalidate single-use token
  user.passwordHash = await hashPasswordSHA256(np);
  delete user.password;
  delete user.resetToken;
  delete user.resetExpires;
  saveUsers(users);
  
  showToast("Password updated successfully. Please log in."); 
  setTimeout(() => window.location.href = "login.html", 800);
}

/* --- Dashboard --- */
function loadDashboard() {
  if (!requireAuthRedirect()) return;
  const curUser = getCurrentUser();
  const userBox = document.getElementById("curUserBox");
  if (userBox) userBox.innerText = curUser;

  const groups = getGroups();
  const cont = document.getElementById("overviewContent");
  
  let totalGroupsCount = groups.length;
  let totalVolumeSpentPaise = 0;
  let userNetBalancePaise = 0;

  groups.forEach(g => {
    const exps = g.expenses || [];
    const members = g.members || [];
    
    // Calculate in integer paise to prevent floating point drift
    const groupTotalPaise = exps.reduce((s, e) => s + Math.round(Number(e.amount) * 100), 0);
    totalVolumeSpentPaise += groupTotalPaise;

    const memberCount = members.length;
    if (memberCount > 0) {
      const sharePaise = Math.round(groupTotalPaise / memberCount);
      const userPaidPaise = exps
        .filter(e => e.paidByEmail.toLowerCase() === curUser.toLowerCase())
        .reduce((s, e) => s + Math.round(Number(e.amount) * 100), 0);
      
      const isMember = members.some(m => m.email.toLowerCase() === curUser.toLowerCase());
      if (isMember) {
        userNetBalancePaise += (userPaidPaise - sharePaise);
      }
    }
  });

  const kpiGroups = document.getElementById("kpiGroups");
  if (kpiGroups) kpiGroups.innerText = totalGroupsCount;
  
  const kpiVolume = document.getElementById("kpiVolume");
  if (kpiVolume) kpiVolume.innerText = `₹ ${(totalVolumeSpentPaise / 100).toFixed(2)}`;
  
  const kpiBalance = document.getElementById("kpiBalance");
  if (kpiBalance) {
    const netFloat = userNetBalancePaise / 100;
    kpiBalance.innerText = `${netFloat >= 0 ? '+' : ''}₹ ${netFloat.toFixed(2)}`;
    kpiBalance.className = `stat-value ${netFloat >= 0 ? 'positive' : 'negative'}`;
  }

  if (!cont) return;
  if (groups.length === 0) {
    cont.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div style="font-weight:700;font-size:15px;">No active groups in ledger</div>
        <div class="small-muted">Create a group to start tracking shared expenses with roommates or friends.</div>
        <a href="add-group.html" class="btn" style="margin-top:6px">+ Create First Group</a>
      </div>`;
  } else {
    cont.innerHTML = groups.map(g => {
      const totalPaise = (g.expenses || []).reduce((s, e) => s + Math.round(Number(e.amount) * 100), 0);
      const membersCount = (g.members || []).length;
      return `
        <div class="group-card">
          <div class="flex-between">
            <div>
              <div style="font-weight:800;font-size:16px;">${escapeHtml(g.name)}</div>
              <div class="small-muted" style="margin-top:2px;">
                ${membersCount} members • ${(g.expenses||[]).length} expenses
              </div>
            </div>
            <div style="text-align:right;">
              <div class="small-muted">Group Total</div>
              <div class="mono" style="font-weight:700;font-size:15px;color:var(--signal-green);">₹ ${(totalPaise / 100).toFixed(2)}</div>
            </div>
          </div>
          <div class="flex" style="margin-top:12px;justify-content:flex-end;">
            <button class="btn btn-sm" onclick="openGroup('${escapeHtml(g.id)}')">Open Ledger</button>
            <button class="btn btn-sm secondary" onclick="deleteGroup('${escapeHtml(g.id)}')">Delete</button>
          </div>
        </div>`;
    }).join("");
  }
}

/* --- Group Management --- */
function loadGroupsPage() {
  if (!requireAuthRedirect()) return;
  const list = document.getElementById("groupList"); 
  if (!list) return;
  const groups = getGroups(); 
  list.innerHTML = "";
  
  if (groups.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <div style="font-weight:700;font-size:15px;">No groups found</div>
        <div class="small-muted">Get started by creating your first expense sharing group.</div>
        <a href="add-group.html" class="btn" style="margin-top:6px">+ Create Group</a>
      </div>`;
    return;
  }
  
  groups.forEach(g => {
    const totalPaise = (g.expenses || []).reduce((s, e) => s + Math.round(Number(e.amount) * 100), 0);
    const members = (g.members || []).length;
    const card = document.createElement("div"); 
    card.className = "group-card";
    card.innerHTML = `
      <div class="flex-between">
        <div>
          <div style="font-weight:800;font-size:16px;">${escapeHtml(g.name)}</div>
          <div class="small-muted" style="margin-top:2px;">
            Members: ${members} • Expenses: ${(g.expenses||[]).length}
          </div>
        </div>
        <div style="text-align:right;">
          <div class="small-muted">Total Spent</div>
          <div class="mono" style="font-weight:700;font-size:15px;color:var(--signal-green);">₹ ${(totalPaise / 100).toFixed(2)}</div>
        </div>
      </div>
      <div class="flex" style="margin-top:12px;justify-content:flex-end;gap:8px;">
        <button class="btn btn-sm" onclick="openGroup('${escapeHtml(g.id)}')">Open Ledger</button>
        <button class="btn btn-sm secondary" onclick="deleteGroup('${escapeHtml(g.id)}')">Delete</button>
      </div>`;
    list.appendChild(card);
  });
}

function createGroup() {
  const input = document.getElementById("groupName"); 
  if (!input) return;
  const name = input.value.trim(); 
  if (!name || name.length > 100) { 
    showToast("Enter a valid group name (max 100 chars)", true); 
    return; 
  }
  
  const cur = getCurrentUser();
  const groups = getGroups();
  const newGroup = { 
    id: "g_" + Date.now(), 
    name, 
    owner: cur, 
    members: [{ name: getUserName(cur), email: cur }], 
    expenses: [] 
  };
  groups.push(newGroup); 
  saveGroups(groups);
  setActiveGroupId(newGroup.id);
  input.value = ""; 
  showToast(`Group "${escapeHtml(name)}" created!`);
  setTimeout(() => window.location.href = "group.html", 400);
}

function openGroup(id) {
  setActiveGroupId(id); 
  window.location.href = "group.html";
}

function deleteGroup(id) {
  if (!confirm("Are you sure you want to delete this group and all its expenses?")) return;
  let groups = getGroups(); 
  groups = groups.filter(g => g.id !== id); 
  saveGroups(groups); 
  showToast("Group deleted");
  if (typeof loadGroupsPage === "function") loadGroupsPage();
  if (typeof loadDashboard === "function") loadDashboard();
}

/* --- Group Details & Ledger --- */
function loadGroupDetails() {
  if (!requireAuthRedirect()) return;
  const gid = getActiveGroupId(); 
  if (!gid) { window.location.href = "groups.html"; return; }
  const groups = getGroups(); 
  const g = groups.find(x => x.id === gid);
  if (!g) { 
    showToast("Group not found", true); 
    window.location.href = "groups.html"; 
    return; 
  }
  
  const titleEl = document.getElementById("gp_title");
  if (titleEl) titleEl.innerText = g.name;

  // Render Member Chips / List
  const memBox = document.getElementById("memberList"); 
  if (memBox) {
    memBox.innerHTML = "";
    (g.members || []).forEach((m, idx) => {
      const div = document.createElement("div"); 
      div.className = "balance-item";
      div.style.marginBottom = "6px";
      div.innerHTML = `
        <div>
          <span style="font-weight:700;">${escapeHtml(m.name)}</span> 
          <span class="small-muted" style="margin-left:6px;">(${escapeHtml(m.email)})</span>
        </div>
        <div>
          ${(g.members.length > 1) ? `<button class="btn btn-sm danger" onclick="removeMember('${escapeHtml(g.id)}', ${idx})">Remove</button>` : `<span class="badge">Admin</span>`}
        </div>`;
      memBox.appendChild(div);
    });
  }

  // Populate PaidBy Select dropdown
  const paidSelect = document.getElementById("expPaidBy");
  if (paidSelect) {
    paidSelect.innerHTML = (g.members || []).map(m => 
      `<option value="${escapeHtml(m.email)}">${escapeHtml(m.name)} (${escapeHtml(m.email)})</option>`
    ).join('');
  }

  renderBalances(); 
  renderExpenses();
}

function addMemberToActive() {
  const nameInput = document.getElementById("memberName");
  const emailInput = document.getElementById("memberEmail");
  const name = nameInput?.value?.trim();
  const email = emailInput?.value?.trim().toLowerCase();
  
  if (!name || !email) { showToast("Enter name and email", true); return; }
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) { showToast("Enter a valid email", true); return; }
  
  const gid = getActiveGroupId(); 
  let groups = getGroups(); 
  const g = groups.find(x => x.id === gid);
  if (!g) return;
  
  if ((g.members || []).some(m => m.email.toLowerCase() === email)) { 
    showToast("Member already exists in this group", true); 
    return; 
  }
  
  g.members = g.members || []; 
  g.members.push({ name, email }); 
  saveGroups(groups);
  
  if (nameInput) nameInput.value = ""; 
  if (emailInput) emailInput.value = "";
  showToast(`Added ${name} to group!`);
  loadGroupDetails();
}

function removeMember(gid, idx) { 
  if (!confirm("Remove this member from the group?")) return; 
  let groups = getGroups(); 
  const g = groups.find(x => x.id === gid); 
  if (!g) return; 
  g.members.splice(idx, 1); 
  saveGroups(groups); 
  showToast("Member removed");
  loadGroupDetails(); 
}

/* --- Expenses --- */
function addExpenseToActive() {
  const nameInput = document.getElementById("expName");
  const amountInput = document.getElementById("expAmount");
  const paidBySelect = document.getElementById("expPaidBy");
  
  const name = nameInput?.value?.trim();
  const rawAmount = Number(amountInput?.value);
  const paidByEmail = paidBySelect?.value?.toLowerCase();
  
  if (!name || name.length > 140) {
    showToast("Enter a valid expense title (max 140 chars)", true);
    return;
  }
  
  // Validation: Must be finite positive number within reasonable boundary
  if (isNaN(rawAmount) || !isFinite(rawAmount) || rawAmount <= 0 || rawAmount > 10000000) { 
    showToast("Enter a valid amount between ₹0.01 and ₹10,000,000", true); 
    return; 
  }
  
  if (!paidByEmail) {
    showToast("Select who paid for this expense", true);
    return;
  }
  
  const gid = getActiveGroupId(); 
  let groups = getGroups(); 
  const g = groups.find(x => x.id === gid);
  if (!g) return;
  
  const payer = (g.members || []).find(m => m.email.toLowerCase() === paidByEmail) || { name: paidByEmail, email: paidByEmail };
  
  // Calculate exact integer paise
  const amountPaise = Math.round(rawAmount * 100);
  const sanitizedAmount = Number((amountPaise / 100).toFixed(2));
  
  const exp = { 
    id: "e_" + Date.now(), 
    name, 
    amount: sanitizedAmount,
    amountPaise, 
    paidByEmail: payer.email, 
    paidByName: payer.name, 
    date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
  };
  
  g.expenses = g.expenses || []; 
  g.expenses.push(exp); 
  saveGroups(groups);
  
  if (nameInput) nameInput.value = ""; 
  if (amountInput) amountInput.value = ""; 
  showToast(`Recorded expense: ₹${sanitizedAmount.toFixed(2)}`);
  loadGroupDetails();
}

function renderExpenses() {
  const gid = getActiveGroupId(); 
  const groups = getGroups(); 
  const g = groups.find(x => x.id === gid); 
  if (!g) return;
  const box = document.getElementById("expenseList"); 
  if (!box) return;
  box.innerHTML = "";
  
  const exps = g.expenses || [];
  if (exps.length === 0) { 
    box.innerHTML = `
      <div class="empty-state" style="padding:20px;">
        <div class="small-muted">No expenses recorded yet. Use the form above to log shared spending.</div>
      </div>`; 
    return; 
  }
  
  exps.slice().reverse().forEach(e => {
    const div = document.createElement("div"); 
    div.className = "group-card";
    div.style.marginBottom = "8px";
    div.innerHTML = `
      <div class="flex-between">
        <div>
          <div style="font-weight:700;font-size:14px;">${escapeHtml(e.name)}</div>
          <div class="small-muted" style="margin-top:2px;">
            Paid by <span style="color:#fff;font-weight:600;">${escapeHtml(e.paidByName)}</span> • ${escapeHtml(e.date)}
          </div>
        </div>
        <div class="flex" style="gap:12px;">
          <div class="mono" style="font-weight:800;font-size:15px;color:var(--signal-green);">₹ ${Number(e.amount).toFixed(2)}</div>
          <button class="btn btn-sm danger" onclick="deleteExpense('${escapeHtml(g.id)}','${escapeHtml(e.id)}')">Delete</button>
        </div>
      </div>`;
    box.appendChild(div);
  });
}

function deleteExpense(gid, expId) { 
  if (!confirm("Delete this expense item?")) return; 
  let groups = getGroups(); 
  const g = groups.find(x => x.id === gid); 
  if (!g) return; 
  g.expenses = (g.expenses || []).filter(e => e.id !== expId); 
  saveGroups(groups); 
  showToast("Expense removed");
  loadGroupDetails(); 
}

/* --- Balances & Settle --- */
function calculateBalancesForActive() {
  const gid = getActiveGroupId(); 
  const groups = getGroups(); 
  const g = groups.find(x => x.id === gid); 
  if (!g) return [];
  
  const members = g.members || []; 
  const exps = g.expenses || [];
  const totalsPaidPaise = {}; 
  members.forEach(m => totalsPaidPaise[m.email.toLowerCase()] = 0);
  
  let totalPaise = 0;
  exps.forEach(e => { 
    const p = Math.round(Number(e.amount) * 100);
    totalsPaidPaise[e.paidByEmail.toLowerCase()] = (totalsPaidPaise[e.paidByEmail.toLowerCase()] || 0) + p; 
    totalPaise += p; 
  });
  
  const perSharePaise = members.length ? Math.round(totalPaise / members.length) : 0;
  return members.map(m => {
    const email = m.email.toLowerCase();
    const paid = totalsPaidPaise[email] || 0;
    const balancePaise = paid - perSharePaise;
    return { 
      name: m.name, 
      email: m.email, 
      paid: paid / 100, 
      share: perSharePaise / 100, 
      balance: balancePaise / 100,
      balancePaise 
    };
  });
}

function renderBalances() {
  const box = document.getElementById("balanceBox"); 
  if (!box) return;
  const balances = calculateBalancesForActive();
  
  if (balances.length === 0) { 
    box.innerHTML = "<div class='small-muted'>No members in group</div>"; 
    return; 
  }
  
  let html = `<div style="font-family:var(--font-mono);font-size:11px;color:var(--ink-muted);margin-bottom:10px;text-transform:uppercase;">Net Standing (Who is Owed / Who Owes)</div>`;
  html += `<div class="grid-2">`;
  balances.forEach(b => { 
    html += `
      <div class="balance-item">
        <div>
          <div style="font-weight:700;font-size:13px;">${escapeHtml(b.name)}</div>
          <div class="small-muted" style="font-size:11px;">Paid: ₹${b.paid.toFixed(2)} • Share: ₹${b.share.toFixed(2)}</div>
        </div>
        <div class="mono ${b.balance >= 0 ? 'positive' : 'negative'}" style="font-size:14px;">
          ${b.balance >= 0 ? '+' : ''}₹ ${b.balance.toFixed(2)}
        </div>
      </div>`; 
  });
  html += `</div>`; 
  box.innerHTML = html;
}

function computeSettleTransactions() {
  const balances = calculateBalancesForActive();
  const creditors = balances.filter(b => b.balancePaise > 0).map(b => ({ name: b.name, email: b.email, amountPaise: b.balancePaise }));
  const debtors = balances.filter(b => b.balancePaise < 0).map(b => ({ name: b.name, email: b.email, amountPaise: -b.balancePaise }));
  
  const tx = []; 
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const owe = debtors[i].amountPaise; 
    const credit = creditors[j].amountPaise; 
    const val = Math.min(owe, credit);
    
    tx.push({ from: debtors[i].name, to: creditors[j].name, amount: val / 100 });
    debtors[i].amountPaise -= val; 
    creditors[j].amountPaise -= val;
    
    if (debtors[i].amountPaise <= 0) i++; 
    if (creditors[j].amountPaise <= 0) j++;
  }
  return tx;
}

function loadSettlePage() {
  if (!requireAuthRedirect()) return;
  const groups = getGroups();
  const groupSelect = document.getElementById("settleGroupSelect");
  const box = document.getElementById("settleList"); 
  if (!box) return;

  if (groups.length === 0) {
    box.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🤝</div>
        <div style="font-weight:700;font-size:15px;">No active groups to settle</div>
        <div class="small-muted">Create a group and add expenses to compute settlement transfers.</div>
        <a href="add-group.html" class="btn" style="margin-top:6px">+ Create Group</a>
      </div>`;
    return;
  }

  let activeGid = getActiveGroupId();
  if (!activeGid || !groups.find(g => g.id === activeGid)) {
    activeGid = groups[0].id;
    setActiveGroupId(activeGid);
  }

  if (groupSelect) {
    groupSelect.innerHTML = groups.map(g => 
      `<option value="${escapeHtml(g.id)}" ${g.id === activeGid ? 'selected' : ''}>${escapeHtml(g.name)}</option>`
    ).join('');
    groupSelect.onchange = function() {
      setActiveGroupId(this.value);
      loadSettlePage();
    };
  }

  const tx = computeSettleTransactions();
  if (tx.length === 0) { 
    box.innerHTML = `
      <div class="empty-state" style="border-color:var(--signal-green);">
        <div style="font-size:24px;color:var(--signal-green);">✓</div>
        <div style="font-weight:700;font-size:15px;color:var(--signal-green);">All Settled Up!</div>
        <div class="small-muted">Everyone has paid their exact fair share. No outstanding wire transfers required.</div>
      </div>`; 
    return; 
  }
  
  box.innerHTML = tx.map(t => `
    <div class="transfer-card">
      <div class="flex" style="gap:8px;">
        <span style="color:var(--signal-coral);font-weight:700;">${escapeHtml(t.from)}</span>
        <span class="small-muted">pays →</span>
        <span style="color:var(--signal-green);font-weight:700;">${escapeHtml(t.to)}</span>
      </div>
      <div class="mono positive" style="font-size:15px;">₹ ${t.amount.toFixed(2)}</div>
    </div>
  `).join("");
}
