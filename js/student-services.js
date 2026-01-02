// --- Storage keys ---
const LEAVE_KEY = 'qlass_student_leave_v1';
const SCHOLARSHIP_KEY = 'qlass_student_scholarship_v1';

// --- Generic storage helpers ---
function getData(key) {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ============================
// Tabs
// ============================
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;

    document.querySelectorAll('.tab-btn')
      .forEach(b => b.classList.toggle('active', b === btn));

    document.querySelectorAll('.tab-content')
      .forEach(panel =>
        panel.classList.toggle('active', panel.id === `tab-${tab}`)
      );
  });
});

// ============================
// Leave Requests
// ============================
const leaveForm = document.getElementById('leaveForm');
const leaveListEl = document.getElementById('leaveList');

document.getElementById('btnNewLeave')?.addEventListener('click', () => {
  leaveForm.classList.remove('hidden');
});

document.getElementById('btnCancelLeave')?.addEventListener('click', () => {
  leaveForm.classList.add('hidden');
  leaveForm.reset();
});

leaveForm?.addEventListener('submit', (e) => {
  e.preventDefault();

  const studentId = document.getElementById('leaveStudentId').value.trim();
  const type = document.getElementById('leaveType').value;
  const start = document.getElementById('leaveStart').value;
  const end = document.getElementById('leaveEnd').value;
  const reason = document.getElementById('leaveReason').value.trim();

  if (!studentId || !start || !end || !reason) {
    alert('Please fill all required leave fields.');
    return;
  }

  if (new Date(end) < new Date(start)) {
    alert('End date cannot be earlier than start date.');
    return;
  }

  const leaves = getData(LEAVE_KEY);
  leaves.push({
    requestId: `LEAVE-${Date.now()}`,
    studentId,
    type,
    start,
    end,
    reason,
    status: 'Pending',
    createdAt: new Date().toISOString()
  });
  saveData(LEAVE_KEY, leaves);

  leaveForm.classList.add('hidden');
  leaveForm.reset();
  renderLeave();
});

function renderLeave() {
  const leaves = getData(LEAVE_KEY);
  leaveListEl.innerHTML = '';

  if (!leaves.length) {
    leaveListEl.innerHTML =
      '<li class="ticket-item empty">No leave requests yet.</li>';
    return;
  }

  leaves
    .slice()
    .reverse()
    .forEach(leave => {
      const li = document.createElement('li');
      li.className = 'ticket-item';
      li.innerHTML = `
        <div class="ticket-line">
          <span><strong>${leave.studentId}</strong> • ${leave.type}</span>
          <span>${leave.status}</span>
        </div>
        <div class="ticket-line">
          <span>${leave.start} → ${leave.end}</span>
          <span>${leave.reason}</span>
        </div>
      `;
      leaveListEl.appendChild(li);
    });
}

// ============================
// Scholarships
// ============================
const schForm = document.getElementById('scholarshipForm');
const schListEl = document.getElementById('scholarshipList');

document.getElementById('btnNewScholarship')?.addEventListener('click', () => {
  schForm.classList.remove('hidden');
});

document.getElementById('btnCancelScholarship')?.addEventListener('click', () => {
  schForm.classList.add('hidden');
  schForm.reset();
});

schForm?.addEventListener('submit', (e) => {
  e.preventDefault();

  const studentId = document.getElementById('schStudentId').value.trim();
  const type = document.getElementById('schType').value;
  const amountValue = document.getElementById('schAmount').value;
  const amount = Number(amountValue);

  if (!studentId || !amountValue) {
    alert('Please fill Student ID and Amount.');
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    alert('Please enter a valid scholarship amount.');
    return;
  }

  const scholarships = getData(SCHOLARSHIP_KEY);
  scholarships.push({
    scholarshipId: `SCH-${Date.now()}`,
    studentId,
    type,
    amount,
    status: 'Applied',
    createdAt: new Date().toISOString()
  });
  saveData(SCHOLARSHIP_KEY, scholarships);

  schForm.classList.add('hidden');
  schForm.reset();
  renderScholarships();
});

function renderScholarships() {
  const scholarships = getData(SCHOLARSHIP_KEY);
  schListEl.innerHTML = '';

  if (!scholarships.length) {
    schListEl.innerHTML =
      '<li class="ticket-item empty">No scholarship applications yet.</li>';
    return;
  }

  scholarships
    .slice()
    .reverse()
    .forEach(sch => {
      const li = document.createElement('li');
      li.className = 'ticket-item';
      li.innerHTML = `
        <div class="ticket-line">
          <span><strong>${sch.studentId}</strong> • ${sch.type}</span>
          <span>${sch.status}</span>
        </div>
        <div class="ticket-line">
          <span>Amount: ₹${sch.amount.toLocaleString()}</span>
          <span>${new Date(sch.createdAt).toLocaleString()}</span>
        </div>
      `;
      schListEl.appendChild(li);
    });
}

// ============================
// Init
// ============================
renderLeave();
renderScholarships();
initMap();
