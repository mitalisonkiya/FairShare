/* script.js - FairShare core (localStorage) */

/* Storage keys */
const USERS_KEY = "fs_users";
const CURRENT_KEY = "fs_currentUser";
const GROUPS_KEY = "fs_groups";
const ACTIVE_KEY = "fs_activeGroup";

/* --- Utilities --- */
function getUsers(){ return JSON.parse(localStorage.getItem(USERS_KEY)) || [] }
function saveUsers(u){ localStorage.setItem(USERS_KEY, JSON.stringify(u)) }
function setCurrentUser(email){ localStorage.setItem(CURRENT_KEY,email) }
function getCurrentUser(){ return localStorage.getItem(CURRENT_KEY) }
function logout(){ localStorage.removeItem(CURRENT_KEY); window.location.href="login.html" }

function getGroups(){ return JSON.parse(localStorage.getItem(GROUPS_KEY)) || [] }
function saveGroups(g){ localStorage.setItem(GROUPS_KEY, JSON.stringify(g)) }

function setActiveGroupId(id){ localStorage.setItem(ACTIVE_KEY,id) }
function getActiveGroupId(){ return localStorage.getItem(ACTIVE_KEY) }

function escapeHtml(str){ if(!str) return ""; return String(str).replace(/[&<>"'`=\/]/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;','=':'&#61;','/':'&#47;'}[s])); }

/* --- Auth --- */
function signupUser(){
  const name = (document.getElementById("su_name")||{}).value?.trim();
  const email = (document.getElementById("su_email")||{}).value?.trim().toLowerCase();
  const pass = (document.getElementById("su_password")||{}).value;
  const pass2 = (document.getElementById("su_password2")||{}).value;
  if(!name||!email||!pass||!pass2){ alert("Fill all fields"); return }
  if(pass.length<6){ alert("Password must be >= 6 chars"); return }
  if(pass!==pass2){ alert("Passwords do not match"); return }
  const users = getUsers();
  if(users.some(u=>u.email===email)){ alert("Email already exists. Use login or reset."); return }
  users.push({name,email,password:pass});
  saveUsers(users);
  setCurrentUser(email);
  window.location.href="dashboard.html";
}
function loginUser(){
  const email = (document.getElementById("li_email")||{}).value?.trim().toLowerCase();
  const pass = (document.getElementById("li_password")||{}).value;
  if(!email||!pass){ alert("Enter email & password"); return }
  const users = getUsers();
  const user = users.find(u=>u.email===email);
  if(!user){ alert("No account found. Signup first."); return }
  if(user.password!==pass){ alert("Incorrect password"); return }
  setCurrentUser(email);
  window.location.href="dashboard.html";
}
function startPasswordReset(){
  const email = (document.getElementById("fp_email")||{}).value?.trim().toLowerCase();
  if(!email){ alert("Enter registered email"); return }
  const users = getUsers(); const idx = users.findIndex(u=>u.email===email);
  if(idx===-1){ alert("Account not found."); return }
  document.getElementById("fp_status").innerText = `Account: ${users[idx].name}. Set new password below.`;
  document.getElementById("fp_new_pw_area").style.display = "block";
  document.getElementById("fp_index").value = idx;
}
function finalizePasswordReset(){
  const idx = Number(document.getElementById("fp_index").value);
  const np = (document.getElementById("fp_new_password")||{}).value;
  const np2 = (document.getElementById("fp_new_password2")||{}).value;
  if(isNaN(idx)){ alert("Start reset first"); return }
  if(!np||!np2){ alert("Fill new passwords"); return }
  if(np.length<6){ alert("Password must be >= 6"); return }
  if(np!==np2){ alert("Passwords do not match"); return }
  const users = getUsers(); users[idx].password = np; saveUsers(users);
  alert("Password updated. Login now."); window.location.href="login.html";
}
function requireAuthRedirect(){ if(!getCurrentUser()){ window.location.href="login.html"; return false } return true }

/* --- Groups --- */
function loadGroupsPage(){
  if(!requireAuthRedirect()) return;
  const list = document.getElementById("groupList"); if(!list) return;
  const groups = getGroups(); list.innerHTML = "";
  if(groups.length===0){ list.innerHTML = "<div class='card small-muted center'>No groups yet.</div>"; return }
  groups.forEach(g=>{
    const total = (g.expenses||[]).reduce((s,e)=>s+Number(e.amount),0);
    const members = (g.members||[]).length;
    const card = document.createElement("div"); card.className = "group-card";
    card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-weight:700">${escapeHtml(g.name)}</div><div class="small-muted">Members: ${members}</div></div>
      <div style="display:flex;flex-direction:column;gap:8px;width:130px">
        <button class="btn" onclick="openGroup('${g.id}')">Open</button>
        <button class="btn secondary" onclick="deleteGroup('${g.id}')">Delete</button>
      </div>
    </div>`;
    list.appendChild(card);
  });
}
function createGroup(){
  const input = document.getElementById("groupName"); if(!input) return;
  const name = input.value.trim(); if(!name) return alert("Enter group name");
  const groups = getGroups();
  const newGroup = { id: "g_"+Date.now(), name, owner: getCurrentUser(), members: [{name:getUserName(getCurrentUser()), email:getCurrentUser()}], expenses: [] };
  groups.push(newGroup); saveGroups(groups);
  input.value = ""; loadGroupsPage();
}
function openGroup(id){
  setActiveGroupId(id); window.location.href = "group.html";
}
function deleteGroup(id){
  if(!confirm("Delete group?")) return;
  let groups = getGroups(); groups = groups.filter(g=>g.id!==id); saveGroups(groups); loadGroupsPage();
}

/* --- group page (members + expenses) --- */
function loadGroupDetails(){
  if(!requireAuthRedirect()) return;
  const gid = getActiveGroupId(); if(!gid){ window.location.href="groups.html"; return }
  const groups = getGroups(); const g = groups.find(x=>x.id===gid);
  if(!g){ alert("Group not found"); window.location.href="groups.html"; return }
  document.getElementById("gp_title").innerText = g.name;
  // members
  const memBox = document.getElementById("memberList"); memBox.innerHTML = "";
  (g.members||[]).forEach((m,idx)=>{
    const div = document.createElement("div"); div.className = "card";
    div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
      <div><b>${escapeHtml(m.name)}</b><div class="small-muted">${escapeHtml(m.email)}</div></div>
      <div style="display:flex;gap:8px">
        <button class="btn secondary" onclick="removeMember('${g.id}',${idx})">Remove</button>
      </div></div>`;
    memBox.appendChild(div);
  });
  renderBalances(); renderExpenses();
}
function addMemberToActive(){
  const name = (document.getElementById("memberName")||{}).value?.trim();
  const email = (document.getElementById("memberEmail")||{}).value?.trim().toLowerCase();
  if(!name||!email) return alert("Enter name and email");
  if(!/\S+@\S+\.\S+/.test(email)) return alert("Invalid email");
  const gid = getActiveGroupId(); let groups = getGroups(); const g = groups.find(x=>x.id===gid);
  if(!g) return;
  if((g.members||[]).some(m=>m.email===email)) return alert("Member already exists");
  g.members = g.members||[]; g.members.push({name,email}); saveGroups(groups);
  document.getElementById("memberName").value=""; document.getElementById("memberEmail").value="";
  loadGroupDetails();
}
function removeMember(gid, idx){ if(!confirm("Remove member?")) return; let groups = getGroups(); const g = groups.find(x=>x.id===gid); if(!g) return; g.members.splice(idx,1); saveGroups(groups); loadGroupDetails(); }

/* --- expenses --- */
function addExpenseToActive(){
  const name = (document.getElementById("expName")||{}).value?.trim();
  const amount = Number((document.getElementById("expAmount")||{}).value);
  const paidByEmail = (document.getElementById("expPaidBy")||{}).value;
  if(!name || !amount || !paidByEmail) return alert("Enter expense details");
  const gid = getActiveGroupId(); let groups = getGroups(); const g = groups.find(x=>x.id===gid);
  if(!g) return;
  const payer = (g.members||[]).find(m=>m.email===paidByEmail) || {name:paidByEmail,email:paidByEmail};
  const exp = { id:"e_"+Date.now(), name, amount:Number(amount), paidByEmail:payer.email, paidByName:payer.name, date:new Date().toLocaleString() };
  g.expenses = g.expenses||[]; g.expenses.push(exp); saveGroups(groups);
  document.getElementById("expName").value=""; document.getElementById("expAmount").value=""; renderExpenses(); renderBalances();
}
function renderExpenses(){
  const gid = getActiveGroupId(); const groups = getGroups(); const g = groups.find(x=>x.id===gid); if(!g) return;
  const box = document.getElementById("expenseList"); if(!box) return;
  box.innerHTML = "";
  const exps = g.expenses||[];
  if(exps.length===0){ box.innerHTML = "<div class='small-muted center'>No expenses yet.</div>"; return }
  exps.forEach(e=>{
    const div = document.createElement("div"); div.className="card";
    div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-weight:700">${escapeHtml(e.name)}</div><div class="small-muted">Paid by ${escapeHtml(e.paidByName)} • ${escapeHtml(e.date)}</div></div>
      <div style="text-align:right"><div style="font-weight:700">₹ ${Number(e.amount).toFixed(2)}</div><div style="margin-top:8px"><button class="btn secondary" onclick="deleteExpense('${g.id}','${e.id}')">Delete</button></div></div>
    </div>`;
    box.appendChild(div);
  });
}
function deleteExpense(gid, expId){ if(!confirm("Delete expense?")) return; let groups = getGroups(); const g = groups.find(x=>x.id===gid); if(!g) return; g.expenses = (g.expenses||[]).filter(e=>e.id!==expId); saveGroups(groups); renderExpenses(); renderBalances(); }

/* --- balances & settle --- */
function calculateBalancesForActive(){
  const gid = getActiveGroupId(); const groups = getGroups(); const g = groups.find(x=>x.id===gid); if(!g) return [];
  const members = g.members||[]; const exps = g.expenses||[];
  const totalsPaid = {}; members.forEach(m=>totalsPaid[m.email]=0);
  let total = 0;
  exps.forEach(e=>{ totalsPaid[e.paidByEmail] = (totalsPaid[e.paidByEmail]||0) + Number(e.amount); total += Number(e.amount); });
  const perShare = members.length ? (total/members.length) : 0;
  return members.map(m=>({ name:m.name, email:m.email, paid: totalsPaid[m.email]||0, share: perShare, balance: (totalsPaid[m.email]||0) - perShare }));
}
function renderBalances(){
  const box = document.getElementById("balanceBox"); if(!box) return;
  const balances = calculateBalancesForActive();
  if(balances.length===0){ box.innerHTML = "<div class='small-muted center'>No members</div>"; return }
  let html = `<div style="display:flex;gap:10px;flex-wrap:wrap">`;
  balances.forEach(b=>{ html += `<div class="card" style="min-width:160px"><div style="font-weight:700">${escapeHtml(b.name)}</div><div class="${b.balance>=0?'positive':'negative'}">₹ ${b.balance.toFixed(2)}</div><div class="small-muted">paid: ₹${b.paid.toFixed(2)} • share: ₹${b.share.toFixed(2)}</div></div>` });
  html += `</div>`; box.innerHTML = html;
}
function computeSettleTransactions(){
  const balances = calculateBalancesForActive();
  const creditors = balances.filter(b=>b.balance>0).map(b=>({name:b.name,amount:Math.round(b.balance*100)/100}));
  const debtors  = balances.filter(b=>b.balance<0).map(b=>({name:b.name,amount:Math.round(-b.balance*100)/100}));
  const tx = []; let i=0,j=0;
  while(i<debtors.length && j<creditors.length){
    const owe = debtors[i].amount; const credit = creditors[j].amount; const val = Math.min(owe,credit);
    tx.push({from:debtors[i].name,to:creditors[j].name,amount:val});
    debtors[i].amount -= val; creditors[j].amount -= val;
    if(Math.abs(debtors[i].amount) < 0.005) i++; if(Math.abs(creditors[j].amount) < 0.005) j++;
  }
  return tx;
}
function loadSettlePage(){
  if(!requireAuthRedirect()) return;
  const box = document.getElementById("settleList"); if(!box) return; const tx = computeSettleTransactions();
  if(tx.length===0){ box.innerHTML = "<div class='small-muted center'>All settled — no transactions required.</div>"; return }
  box.innerHTML = tx.map(t=>`<div class='card'><b>${escapeHtml(t.from)}</b> → <b>${escapeHtml(t.to)}</b> : ₹ ${t.amount.toFixed(2)}</div>`).join("");
}

/* helper */
function getUserName(email){ const u = getUsers().find(x=>x.email===email); return u? u.name : email }
const API = "http://localhost:5000/api";
async function sendInvite() {
    const email = document.getElementById("inviteEmail").value;

    const res = await fetch("http://localhost:3000/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (data.success) {
        alert("Invite sent!");
    } else {
        alert("Failed: " + data.error);
    }
}
