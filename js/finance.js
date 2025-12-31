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
    const record = financeRecords[app.id] || {};
    const items  = record.items || {};
    const paid   = record.paid ? 'Paid' : 'Unpaid';
    const tsLabel = record.timestamp
      ? new Date(record.timestamp).toLocaleString()
      : '—';

    const statusClass = record.paid ? 'status-paid' : 'status-unpaid';
    const val = (key) => (items[key] != null ? items[key] : '');

    return `
      <li class="ticket-item" data-id="${app.id}">
        <div class="ticket-line">
          <span class="ticket-student-id">${app.studentId || 'Pending ID'}</span>
          <span class="ticket-name">${app.name}</span>
          <span class="ticket-course">${app.course}</span>
        </div>

        <div class="fee-table-wrapper">
          <table class="fee-table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Books</td>
                <td>
                  <input type="number" min="0" step="0.01"
                         class="fee-input" data-field="books"
                         value="${val('books')}">
                </td>
              </tr>
              <tr>
                <td>Uniform</td>
                <td>
                  <input type="number" min="0" step="0.01"
                         class="fee-input" data-field="uniform"
                         value="${val('uniform')}">
                </td>
              </tr>
              <tr>
                <td>1st Term</td>
                <td>
                  <input type="number" min="0" step="0.01"
                         class="fee-input" data-field="term1"
                         value="${val('term1')}">
                </td>
              </tr>
              <tr>
                <td>2nd Term</td>
                <td>
                  <input type="number" min="0" step="0.01"
                         class="fee-input" data-field="term2"
                         value="${val('term2')}">
                </td>
              </tr>
              <tr>
                <td>3rd Term</td>
                <td>
                  <input type="number" min="0" step="0.01"
                         class="fee-input" data-field="term3"
                         value="${val('term3')}">
                </td>
              </tr>
              <tr>
                <td>4th Term</td>
                <td>
                  <input type="number" min="0" step="0.01"
                         class="fee-input" data-field="term4"
                         value="${val('term4')}">
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <th>
                  <span class="fee-total">
                    ₹${record.total != null ? Number(record.total).toFixed(2) : '0.00'}
                  </span>
                </th>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="ticket-line finance-line">
          <span class="finance-status ${statusClass}">Fee: ${paid}</span>
          <span class="finance-time">Last updated: ${tsLabel}</span>
          <button
            class="btn btn-primary btn-sm"
            data-action="save-fee"
            data-ticket-id="${app.id}">
            Save fee details
          </button>
        </div>
      </li>
    `;
  }).join('');
}

// --- Save fee + total for one ticket ---
function saveFeeForTicket(ticketId) {
  const itemEl = financeList.querySelector(`.ticket-item[data-id="${ticketId}"]`);
  if (!itemEl) return;

  const inputs = itemEl.querySelectorAll('.fee-input');
  const items = {};
  let total = 0;

  inputs.forEach(input => {
    const field = input.dataset.field;
    if (!field) return;

    const valueStr = input.value.trim();
    if (!valueStr) {
      items[field] = 0;
      return;
    }

    const num = parseFloat(valueStr);
    if (isNaN(num)) {
      items[field] = 0;
      return;
    }

    items[field] = num;
    total += num;
  });

  financeRecords[ticketId] = {
    paid: total > 0,
    items,
    total,
    timestamp: new Date().toISOString()
  };

  try {
    localStorage.setItem(FINANCE_KEY, JSON.stringify(financeRecords)); // nested object via JSON [web:185]
  } catch (err) {
    console.warn('Failed to save finance records', err);
  }

  renderFinanceList();
  showToast('Fee details saved');
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
    const btn = e.target.closest('button[data-action="save-fee"]');
    if (!btn) return;
    const ticketId = btn.dataset.ticketId;
    saveFeeForTicket(ticketId);
  });
}

// --- Init ---
renderFinanceList();
