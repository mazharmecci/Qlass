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
// financeRecords[ticketId] = {
//   paid: true/false,
//   items: { books, uniform, term1, term2, term3, term4 },
//   timestamps: { books, uniform, term1, term2, term3, term4 },
//   total: number,
//   lastUpdated: ISO string
// }
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
      stages: app.stages || {},
      timestamps: app.timestamps || {}
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
    const stamps = record.timestamps || {};
    const paid   = record.paid ? 'Paid' : 'Unpaid';
    const tsLabel = record.lastUpdated
      ? new Date(record.lastUpdated).toLocaleString()
      : '—';

    const statusClass = record.paid ? 'status-paid' : 'status-unpaid';

    // Always return a 2-decimal string (or empty when no value set)
    const val = (key) => {
      const raw = items[key];
      if (raw == null || raw === '') return '';
      const num = Number(raw);
      if (Number.isNaN(num)) return '';
      return num.toFixed(2); // keep two decimals
    };

    const stampText = (key) =>
      stamps[key] ? new Date(stamps[key]).toLocaleString() : '';

    // Safe enrollment timestamp (works for ISO or stored display strings)
    let enrollmentTs = '—';
    if (app.timestamps && app.timestamps.enrollment) {
      const raw = app.timestamps.enrollment;
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        enrollmentTs = d.toLocaleString();
      }
    }

    const headerLine =
      `${app.studentId || 'Pending ID'} ${app.name} ${app.course} - Enrolled on ${enrollmentTs}`;

    const row = (label, key) => `
      <tr>
        <td>${label}</td>
        <td>
          <div class="fee-cell">
            <input
              type="number"
              min="0"
              step="0.01"
              class="fee-input"
              data-field="${key}"
              value="${val(key)}"
            >
            <span class="fee-timestamp">
              ${stampText(key) ? `• ${stampText(key)}` : ''}
            </span>
          </div>
        </td>
      </tr>
    `;

    const total = record.total != null ? Number(record.total) : 0;
    const totalLabel = total.toFixed(2);

    return `
      <li class="ticket-item" data-id="${app.id}">
        <div class="ticket-line ticket-line-top">
          <span class="ticket-top-summary">${headerLine}</span>
        </div>

        <div class="ticket-line finance-summary">
          <span class="summary-pill">
            Total paid: ₹${totalLabel}
          </span>
          <span class="summary-muted">
            (Course fee & balance to be configured later)
          </span>
        </div>

        <div class="fee-table-wrapper">
          <table class="fee-table">
            <colgroup>
              <col>
              <col>
            </colgroup>
            <thead>
              <tr>
                <th>Component</th>
                <th>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${row('Books', 'books')}
              ${row('Uniform', 'uniform')}
              ${row('1st Term', 'term1')}
              ${row('2nd Term', 'term2')}
              ${row('3rd Term', 'term3')}
              ${row('4th Term', 'term4')}
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <th>
                  <span class="fee-total">
                    ₹${totalLabel}
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
} // <-- this closing brace fixes the Unexpected end of input

// --- Save fee + per-field timestamps for one ticket ---
function saveFeeForTicket(ticketId) {
  const itemEl = financeList.querySelector(`.ticket-item[data-id="${ticketId}"]`);
  if (!itemEl) return;

  const prevRecord = financeRecords[ticketId] || {};
  const prevItems  = prevRecord.items || {};
  const prevStamps = prevRecord.timestamps || {};

  const inputs = itemEl.querySelectorAll('.fee-input');
  const items = {};
  const timestamps = {};
  let total = 0;
  const nowIso = new Date().toISOString();

  inputs.forEach(input => {
    const field = input.dataset.field;
    if (!field) return;

    const valueStr = input.value.trim();
    let num = 0;

    if (valueStr) {
      const parsed = parseFloat(valueStr);
      if (!isNaN(parsed)) num = parsed;
    }

    items[field] = num;

    const prev = prevItems[field] != null ? prevItems[field] : 0;

    if (num > 0) {
      if (num !== prev) {
        timestamps[field] = nowIso;
      } else if (prevStamps[field]) {
        timestamps[field] = prevStamps[field];
      }
      total += num;
    } else if (prevStamps[field]) {
      timestamps[field] = prevStamps[field];
    }
  });

  financeRecords[ticketId] = {
    paid: total > 0,
    items,
    timestamps,
    total,
    lastUpdated: nowIso
  };

  localStorage.setItem(FINANCE_KEY, JSON.stringify(financeRecords)); // JSON localStorage pattern [web:185][web:239]
  renderFinanceList();
  showToast('Fee details saved');
}

// --- Event wiring ---
if (searchInput) {
  searchInput.addEventListener('input', () => {
    renderFinanceList();
  });
}

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
