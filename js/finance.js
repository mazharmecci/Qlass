// Qlass/js/finance.js

// financeRecords[ticketId] = {
//   paid: true/false,
//   items: { books, uniform, term1, term2, term3, term4 },
//   timestamps: { books, uniform, term1, term2, term3, term4 },
//   paymentMethods: { books, uniform, term1, term2, term3, term4 }, // 'cash' | 'cheque' | ''
//   total: number,
//   lastUpdated: ISO string
// }

const ADMISSIONS_KEY = 'qlass_admissions_state_v2';
const FINANCE_KEY    = 'qlass_finance_records_v1';

const toast       = document.getElementById('toast');
const financeList = document.getElementById('financeList');
const searchInput = document.getElementById('financeSearch');

// --- Toast helper ---
function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

// --- Load admissions data shared via localStorage ---
function loadAdmissionsState() {
  try {
    const raw = localStorage.getItem(ADMISSIONS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : null;
  } catch (err) {
    console.warn('Failed to load admissions state', err);
    return null;
  }
}

// --- Load finance records ---
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
      name: app.name || 'Unnamed',
      course: app.course || '—',
      stages: app.stages || {},
      timestamps: app.timestamps || {}
    }))
    .filter(app => app.stages.enrollment === 'enrolled');
}

// --- Receipt helpers ---
function buildReceiptText(app, record) {
  const items          = record.items || {};
  const timestamps     = record.timestamps || {};
  const paymentMethods = record.paymentMethods || {};
  const total          = record.total != null ? Number(record.total) : 0;

  const lines = [];

  lines.push(`Student: ${app.name} (${app.studentId || 'Pending ID'})`);
  lines.push(`Course: ${app.course}`);
  if (app.timestamps && app.timestamps.enrollment) {
    const d = new Date(app.timestamps.enrollment);
    if (!isNaN(d.getTime())) {
      lines.push(`Enrolled on: ${d.toLocaleString()}`);
    }
  }
  lines.push('');

  lines.push('Fee components (₹):');
  const keys = [
    ['Books', 'books'],
    ['Uniform', 'uniform'],
    ['1st Term', 'term1'],
    ['2nd Term', 'term2'],
    ['3rd Term', 'term3'],
    ['4th Term', 'term4']
  ];

  keys.forEach(([label, key]) => {
    const raw = items[key];
    const num = raw != null ? Number(raw) : 0;
    if (!Number.isNaN(num) && num > 0) {
      const tsRaw = timestamps[key];
      const method = paymentMethods[key] || '';
      let tsPart = '';
      if (tsRaw) {
        const d = new Date(tsRaw);
        if (!isNaN(d.getTime())) {
          tsPart = d.toLocaleString();
        }
      }

      let methodPart = '';
      if (method === 'cash') {
        methodPart = 'paid by cash';
      } else if (method === 'cheque') {
        methodPart = 'paid by cheque';
      }

      const suffix = [tsPart, methodPart].filter(Boolean).join(' • ');
      lines.push(`- ${label}: ₹${num.toFixed(2)}${suffix ? ' • ' + suffix : ''}`);
    }
  });

  lines.push(`Total paid till date: ₹${total.toFixed(2)}`);
  lines.push('');
  lines.push('This is a system-generated fee summary.');

  return lines.join('\n');
}

// --- Show receipt INSIDE the ticket, next to the table ---
function showReceiptSnippet(ticketId, text) {
  const ticket = financeList.querySelector(`.ticket-item[data-id="${ticketId}"]`);
  if (!ticket) return;

  const box = ticket.querySelector('.receipt-inline-body[data-receipt-body]');
  if (!box) return;

  box.classList.remove('receipt-inline-empty');
  box.innerHTML = text.replace(/\n/g, '<br>');
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
    const record         = financeRecords[app.id] || {};
    const items          = record.items || {};
    const stamps         = record.timestamps || {};
    const paymentMethods = record.paymentMethods || {};

    const paid     = record.paid ? 'Paid' : 'Unpaid';
    const tsLabel  = record.lastUpdated
      ? new Date(record.lastUpdated).toLocaleString()
      : '—';
    const statusClass = record.paid ? 'status-paid' : 'status-unpaid';

    // Format values safely
    const val = (key) => {
      const raw = items[key];
      if (raw == null || raw === '') return '';
      const num = Number(raw);
      return Number.isNaN(num) ? '' : num.toFixed(2);
    };

    const methodVal = (key) => paymentMethods[key] || '';

    const stampText = (key) => {
      const tsRaw = stamps[key];
      if (!tsRaw) return '';
      const d = new Date(tsRaw);
      if (isNaN(d.getTime())) return '';
      const method = paymentMethods[key] || '';
      const base = d.toLocaleString();
      if (method === 'cash') return `${base} • paid by cash`;
      if (method === 'cheque') return `${base} • paid by cheque`;
      return base;
    };

    // Safe enrollment timestamp
    let enrollmentTs = '—';
    if (app.timestamps && app.timestamps.enrollment) {
      const raw = app.timestamps.enrollment;
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        enrollmentTs = d.toLocaleString();
      }
    }

    const headerLine =
      `${app.studentId || 'Pending ID'} ${app.name || 'Unnamed'} ${app.course || '—'} - Enrolled on ${enrollmentTs}`;

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
          </div>
        </td>
        <td>
          <select
            class="payment-method-select"
            data-field="${key}"
          >
            <option value="">Type</option>
            <option value="cash" ${methodVal(key) === 'cash' ? 'selected' : ''}>Cash</option>
            <option value="cheque" ${methodVal(key) === 'cheque' ? 'selected' : ''}>Cheque</option>
          </select>
        </td>
        <td>
          <span class="fee-timestamp" title="${stampText(key)}">
            ${stampText(key) ? `• ${stampText(key)}` : ''}
          </span>
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
          <span class="summary-pill">Total paid: ₹${totalLabel}</span>
          <span class="summary-muted">(Course fee & balance to be configured later)</span>
        </div>

        <div class="fee-and-receipt">
          <div class="fee-table-wrapper">
            <table class="fee-table">
              <colgroup>
                <col style="width:30%">
                <col style="width:20%">
                <col style="width:25%">
                <col style="width:25%">
              </colgroup>
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Amount (₹)</th>
                  <th>Type</th>
                  <th>When / how</th>
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
                  <th><span class="fee-total">₹${totalLabel}</span></th>
                  <th colspan="2"></th>
                </tr>
              </tfoot>
            </table>
          </div>

          <div class="receipt-inline">
            <div class="receipt-inline-title">WhatsApp receipt</div>
            <div class="receipt-inline-body receipt-inline-empty" data-receipt-body>
              Click WA to preview receipt here.
            </div>
          </div>
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
          <button
            class="btn btn-outline-success btn-sm btn-whatsapp"
            title="Generate WhatsApp receipt"
            data-action="whatsapp-receipt"
            data-ticket-id="${app.id}">
            WA
          </button>
        </div>
      </li>
    `;
  }).join('');
}

// --- Save fee + per-field timestamps for one ticket ---
function saveFeeForTicket(ticketId) {
  const itemEl = financeList.querySelector(`.ticket-item[data-id="${ticketId}"]`);
  if (!itemEl) return;

  const prevRecord  = financeRecords[ticketId] || {};
  const prevItems   = prevRecord.items || {};
  const prevStamps  = prevRecord.timestamps || {};
  const prevMethods = prevRecord.paymentMethods || {};

  const inputs      = itemEl.querySelectorAll('.fee-input');
  const typeSelects = itemEl.querySelectorAll('.payment-method-select');

  const items          = {};
  const timestamps     = {};
  const paymentMethods = {};
  let total = 0;
  const nowIso = new Date().toISOString();

  // Map field -> method from selects
  typeSelects.forEach(sel => {
    const field = sel.dataset.field;
    if (!field) return;
    paymentMethods[field] = sel.value || '';
  });

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
      // update timestamp if value changed
      if (num !== prev) {
        timestamps[field] = nowIso;
      } else if (prevStamps[field]) {
        timestamps[field] = prevStamps[field];
      }
      total += num;
    } else if (prevStamps[field]) {
      timestamps[field] = prevStamps[field];
    }

    // preserve previous method if none selected now
    if (!paymentMethods[field] && prevMethods[field]) {
      paymentMethods[field] = prevMethods[field];
    }
  });

  financeRecords[ticketId] = {
    paid: total > 0,
    items,
    timestamps,
    paymentMethods,
    total,
    lastUpdated: nowIso
  };

  try {
    localStorage.setItem(FINANCE_KEY, JSON.stringify(financeRecords));
  } catch (err) {
    console.warn('Failed to persist finance records', err);
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

if (financeList) {
  financeList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action   = btn.dataset.action;
    const ticketId = btn.dataset.ticketId;
    if (!ticketId) return;

    if (action === 'save-fee') {
      saveFeeForTicket(ticketId);
      return;
    }

    if (action === 'whatsapp-receipt') {
      const app = getEnrolledApplications().find(a => a.id === ticketId);
      const record = financeRecords[ticketId] || {};
      if (!app) return;

      const text = buildReceiptText(app, record);
      showReceiptSnippet(ticketId, text);
    }
  });
}

// --- Init ---
renderFinanceList();
