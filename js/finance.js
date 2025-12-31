// Qlass/js/finance.js

const ADMISSIONS_KEY = 'qlass_admissions_state_v2';
const FINANCE_KEY    = 'qlass_finance_records_v1';

const toast       = document.getElementById('toast');
const financeList = document.getElementById('financeList');
const searchInput = document.getElementById('financeSearch');

function showToast(msg){
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(()=> toast.classList.remove('show'), 1800);
}

// --- Load admissions data shared via localStorage ---
function loadAdmissionsState() {
  try {
    const raw = localStorage.getItem(ADMISSIONS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (err) {
    console.warn('Failed to load admissions state', err);
    return null;
  }
}

// Finance records: keyed by ticket ID
let financeRecords = {};
try {
  financeRecords = JSON.parse(localStorage.getItem(FINANCE_KEY) || '{}');
} catch (err) {
  financeRecords = {};
}

// --- Build enrolled list from Admissions ---
function getEnrolledApplications() {
  const admissions = loadAdmissionsState();
  if (!admissions || !Array.isArray(admissions.applications)) return [];

  return admissions.applications
    .map(app => ({
      ...app,
      studentId: app.studentId || null,
      stages: app.stages || {}
    }))
    .filter(app => app.stages.enrollment === 'enrolled');
}

// --- Render finance list (with optional search) ---
function renderFinanceList() {
  const enrolled = getEnrolledApplications();
  const q = (searchInput?.value || '').trim().toLowerCase();

  if (!enrolled.length) {
    financeList.innerHTML = `
      <li class="ticket-item empty">
        No enrolled students found yet. Complete enrollment in Admissions to see them here.
      </li>`;
    return;
  }

  const filtered = enrolled.filter(app => {
    const name = (app.name || '').toLowerCase();
    const studId = (app.studentId || '').toLowerCase();
    const ticketId = (app.id || '').toLowerCase();
    if (!q) return true;
    return (
      name.includes(q) ||
      studId.includes(q) ||
      ticketId.includes(q)
    );
  });

  if (!filtered.length) {
    financeList.innerHTML = `
      <li class="ticket-item empty">
        No students match your search/filter.
      </li>`;
    return;
  }

  financeList.innerHTML = filtered.map(app => {
    const record = financeRecords[app.id];
    const paid = record?.paid ? 'Paid' : 'Unpaid';
    const amount = record?.amount != null ? record.amount : '—';
    const tsLabel = record?.timestamp
      ? new Date(record.timestamp).toLocaleString()
      : '—';

    const statusClass = record?.paid ? 'status-paid' : 'status-unpaid';

    return `
      <li class="ticket-item" data-id="${app.id}">
        <div class="ticket-line">
          <span class="ticket-student-id">${app.studentId || 'Pending ID'}</span>
          <span class="ticket-name">${app.name}</span>
          <span class="ticket-course">${app.course}</span>
        </div>
        <div class="ticket-line finance-line">
          <span class="finance-status ${statusClass}">Fee: ${paid}</span>
          <span class="finance-amount">Amount: ₹${amount}</span>
          <span class="finance-time">${tsLabel}</span>
          <button
            class="btn btn-primary btn-sm"
            data-action="collect"
            data-ticket-id="${app.id}">
            ${record?.paid ? 'Update Fee' : 'Collect Fee'}
          </button>
        </div>
      </li>
    `;
  }).join('');
}

// --- Fee collection logic ---
function collectFee(ticketId) {
  const enrolled = getEnrolledApplications();
  const app = enrolled.find(a => a.id === ticketId);
  if (!app) {
    showToast('Student not found or not enrolled');
    return;
  }

  const existing = financeRecords[ticketId];
  const initial = existing?.amount != null ? String(existing.amount) : '';

  const amountStr = prompt(
    `Enter fee amount for ${app.name} (${app.studentId || app.id}):`,
    initial
  );

  if (amountStr === null) {
    return; // cancelled
  }

  const clean = amountStr.trim();
  if (!clean || isNaN(clean)) {
    showToast('Invalid amount');
    return;
  }

  const amount = parseFloat(clean);

  financeRecords[ticketId] = {
    paid: true,
    amount,
    timestamp: new Date().toISOString()
  };

  try {
    localStorage.setItem(FINANCE_KEY, JSON.stringify(financeRecords));
  } catch (err) {
    console.warn('Failed to save finance records', err);
  }

  renderFinanceList();
  showToast(`Fee recorded for ${app.name}`);
}

// --- Event wiring ---
if (searchInput) {
  searchInput.addEventListener('input', () => {
    renderFinanceList();
  });
}

// Delegate button clicks on the list
if (financeList) {
  financeList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action="collect"]');
    if (!btn) return;
    const ticketId = btn.dataset.ticketId;
    collectFee(ticketId);
  });
}

// --- Init ---
renderFinanceList();
