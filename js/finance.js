// Qlass/js/finance.js

const ADMISSIONS_KEY = 'qlass_admissions_state_v2';
const FINANCE_KEY    = 'qlass_finance_records_v1';

const toast          = document.getElementById('toast');
const financeList    = document.getElementById('financeList');
const searchInput    = document.getElementById('financeSearch');
const receiptPreview = document.getElementById('receiptPreview');

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
//   lastUpdated: ISO string,
//   payment: {
//     method: 'cash' | 'cheque' | '',
//     chequeNo: string,
//     bankName: string
//   }
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

// --- Receipt helpers ---
function buildReceiptText(app, record) {
  const items   = record.items || {};
  const payment = record.payment || {};
  const total   = record.total != null ? Number(record.total) : 0;

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
      lines.push(`- ${label}: ₹${num.toFixed(2)}`);
    }
  });

  lines.push(`Total paid till date: ₹${total.toFixed(2)}`);
  lines.push('');

  const method = payment.method || '';
  if (method === 'cash') {
    lines.push('Payment method: Cash');
  } else if (method === 'cheque') {
    lines.push('Payment method: Cheque');
    if (payment.chequeNo) {
      lines.push(`Cheque no.: ${payment.chequeNo}`);
    }
    if (payment.bankName) {
      lines.push(`Bank: ${payment.bankName}`);
    }
  } else {
    lines.push('Payment method: Not specified');
  }

  lines.push('');
  lines.push('This is a system-generated fee summary.');

  return lines.join('\n'); // template-literal style receipt [web:245][web:287]
}

function showReceiptSnippet(text) {
  if (!receiptPreview) return;
  receiptPreview.innerHTML = `
    <div class="receipt-preview-title">WhatsApp receipt preview</div>
    <div class="receipt-preview-body">${text.replace(/\n/g, '<br>')}</div>
    <div class="receipt-actions">
      Copy this text and paste it into WhatsApp chat with the parent/guardian.
    </div>
  `;
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
    const record  = financeRecords[app.id] || {};
    const items   = record.items || {};
    const stamps  = record.timestamps || {};
    const payment = record.payment || {};

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
      return num.toFixed(2);
    };

    const stampText = (key) =>
      stamps[key] ? new Date(stamps[key]).toLocaleString() : '';

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

    const method   = payment.method || '';
    const chequeNo = payment.chequeNo || '';
    const bankName = payment.bankName || '';

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
          <button
            class="btn btn-ghost btn-sm btn-whatsapp"
            title="Generate WhatsApp receipt"
            data-action="whatsapp-receipt"
            data-ticket-id="${app.id}">
            <span class="wa-icon">🟢 WA</span>
          </button>
        </div>

        <div class="ticket-line payment-line">
          <div class="payment-block">
            <label>
              Type of transaction
              <select class="payment-method" data-ticket-id="${app.id}">
                <option value="">Select</option>
                <option value="cash" ${method === 'cash' ? 'selected' : ''}>Cash</option>
                <option value="cheque" ${method === 'cheque' ? 'selected' : ''}>Cheque</option>
              </select>
            </label>

            <div class="cheque-fields ${method === 'cheque' ? '' : 'hidden'}">
              <label>
                Cheque no.
                <input
                  type="text"
                  class="cheque-no-input"
                  data-ticket-id="${app.id}"
                  value="${chequeNo}"
                >
              </label>
              <label>
                Bank name
                <input
                  type="text"
                  class="bank-name-input"
                  data-ticket-id="${app.id}"
                  value="${bankName}"
                >
              </label>
            </div>
          </div>
        </div>
      </li>
    `;
  }).join('');
}

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

  // Read payment info
  const methodSelect  = itemEl.querySelector('.payment-method');
  const chequeNoInput = itemEl.querySelector('.cheque-no-input');
  const bankNameInput = itemEl.querySelector('.bank-name-input');

  const method   = methodSelect ? methodSelect.value : '';
  const chequeNo = chequeNoInput ? chequeNoInput.value.trim() : '';
  const bankName = bankNameInput ? bankNameInput.value.trim() : '';

  financeRecords[ticketId] = {
    paid: total > 0,
    items,
    timestamps,
    total,
    lastUpdated: nowIso,
    payment: {
      method,
      chequeNo: method === 'cheque' ? chequeNo : '',
      bankName: method === 'cheque' ? bankName : ''
    }
  };

  localStorage.setItem(FINANCE_KEY, JSON.stringify(financeRecords)); // localStorage pattern [web:185]
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
      showReceiptSnippet(text);
    }
  });

  // Dynamic show/hide for cheque fields
  financeList.addEventListener('change', (e) => {
    const select = e.target.closest('.payment-method');
    if (!select) return;

    const ticketItem = select.closest('.ticket-item');
    if (!ticketItem) return;

    const chequeBlock = ticketItem.querySelector('.cheque-fields');
    if (!chequeBlock) return;

    if (select.value === 'cheque') {
      chequeBlock.classList.remove('hidden');
    } else {
      chequeBlock.classList.add('hidden');
    }
  });
}

// --- Init ---
renderFinanceList();
