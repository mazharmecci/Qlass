// Qlass/js/admissions.js

// --- In-memory state ---
const state = {
  application: null,   // current / active application
  applications: [],    // history / future multi-application UI
  stages: {
    verification: 'pending', // pending | verified | rejected | waitlisted
    approval: 'pending',     // pending | approved | rejected | waitlisted
    enrollment: 'pending'    // pending | enrolled | rejected
  },
  timestamps: {
    verification: null,
    approval: null,
    enrollment: null
  }
};

// --- Persistence (localStorage) ---
const STORAGE_KEY = 'qlass_admissions_state_v1';

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Failed to save state', err);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;

    state.application = parsed.application || null;
    state.applications = Array.isArray(parsed.applications) ? parsed.applications : [];
    state.stages = Object.assign(
      { verification: 'pending', approval: 'pending', enrollment: 'pending' },
      parsed.stages || {}
    );
    state.timestamps = Object.assign(
      { verification: null, approval: null, enrollment: null },
      parsed.timestamps || {}
    );
  } catch (err) {
    console.warn('Failed to load state', err);
  }
}

function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear state', err);
  }
  state.application = null;
  state.applications = [];
  state.stages = {
    verification: 'pending',
    approval: 'pending',
    enrollment: 'pending'
  };
  state.timestamps = {
    verification: null,
    approval: null,
    enrollment: null
  };
  resetStages();
  updateTicketViewer();
  renderTicketHistory();
  showToast('Saved state cleared');
}

// --- Elements ---
const form = document.getElementById('applicationForm');
const toast = document.getElementById('toast');
const pipelineFill = document.getElementById('pipelineFill');
const clearStateBtn = document.getElementById('clearState'); // <button id="clearState">Clear saved state</button>

const statusEls = {
  verification: document.getElementById('statusVerification'),
  approval: document.getElementById('statusApproval'),
  enrollment: document.getElementById('statusEnrollment')
};
const metaEls = {
  verification: document.getElementById('metaVerification'),
  approval: document.getElementById('metaApproval'),
  enrollment: document.getElementById('metaEnrollment')
};

const verificationSelect = document.getElementById('verificationAction');
const approvalSelect = document.getElementById('approvalAction');
const enrollmentSelect = document.getElementById('enrollmentAction');

const applyVerificationBtn = document.getElementById('applyVerification');
const applyApprovalBtn = document.getElementById('applyApproval');
const applyEnrollmentBtn = document.getElementById('applyEnrollment');

// --- Helpers ---
function showToast(message){
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(()=> toast.classList.remove('show'), 1800);
}

function setBadge(el, status){
  el.className = 'status-badge ' + status;
  el.textContent = status[0].toUpperCase() + status.slice(1);
}

function formatTimestamp(ts){
  if (!ts) return '';
  return ' (' + ts + ')';
}

function updatePipelineProgress(){
  let progress = 0;
  if (state.stages.verification === 'verified') progress = 33;
  if (state.stages.approval === 'approved') progress = 66;
  if (state.stages.enrollment === 'enrolled') progress = 100;
  pipelineFill.style.width = progress + '%';
}

function resetStages(){
  // Do NOT overwrite state.stages here; use what is in state
  setBadge(statusEls.verification, state.stages.verification);
  setBadge(statusEls.approval, state.stages.approval);
  setBadge(statusEls.enrollment, state.stages.enrollment);

  if (state.application) {
    metaEls.verification.textContent =
      (state.stages.verification === 'pending'
        ? 'Submitted: awaiting verification'
        : {
            verified: 'Documents verified by Admissions Officer',
            rejected: 'Rejected at verification',
            waitlisted: 'Waitlisted at verification'
          }[state.stages.verification] || 'Verification status') +
      formatTimestamp(state.timestamps.verification);

    metaEls.approval.textContent =
      (state.stages.approval === 'pending'
        ? (state.stages.verification === 'verified'
            ? 'Ready for Dean/Principal review'
            : 'Requires verified status')
        : {
            approved: 'Approved by Dean/Principal',
            rejected: 'Rejected at approval',
            waitlisted: 'Waitlisted at approval'
          }[state.stages.approval] || 'Approval status') +
      formatTimestamp(state.timestamps.approval);

    metaEls.enrollment.textContent =
      (state.stages.enrollment === 'pending'
        ? (state.stages.approval === 'approved'
            ? 'Ready for Registrar enrollment'
            : 'Requires approved status')
        : {
            enrolled: 'Enrollment completed by Registrar',
            rejected: 'Rejected at enrollment'
          }[state.stages.enrollment] || 'Enrollment status') +
      formatTimestamp(state.timestamps.enrollment);
  } else {
    // No application yet
    metaEls.verification.textContent = 'Awaiting submission';
    metaEls.approval.textContent = 'Requires verified status';
    metaEls.enrollment.textContent = 'Requires approved status';
  }

  updatePipelineProgress();
}

// --- Ticket viewer (current ticket) ---
function updateTicketViewer() {
  const viewer = document.getElementById('ticketViewer');
  const summary = document.getElementById('ticketSummary');

  if (!viewer || !summary) return;

  if (!state.application) {
    viewer.style.display = 'none';
    summary.innerHTML = '';
    return;
  }

  const stage = state.stages.enrollment !== 'pending'
    ? 'Enrollment'
    : state.stages.approval !== 'pending'
    ? 'Approval'
    : state.stages.verification !== 'pending'
    ? 'Verification'
    : 'Not started';

  const status = state.stages.enrollment !== 'pending'
    ? state.stages.enrollment
    : state.stages.approval !== 'pending'
    ? state.stages.approval
    : state.stages.verification !== 'pending'
    ? state.stages.verification
    : 'pending';

  const label = status[0].toUpperCase() + status.slice(1);

  summary.innerHTML = `
    <strong>Ticket ID:</strong> ${state.application.id}<br>
    <strong>Student:</strong> ${state.application.name}<br>
    <strong>Course:</strong> ${state.application.course}<br>
    <strong>Current Stage:</strong> ${stage}<br>
    <strong>Status:</strong> <span class="status-badge ${status}">${label}</span>
  `;

  viewer.style.display = 'block';
}

// --- Ticket history (multiple tickets) ---
function renderTicketHistory() {
  const historySection = document.getElementById('ticketHistory');
  const listEl = document.getElementById('ticketHistoryList');

  if (!historySection || !listEl) return;

  listEl.innerHTML = '';

  if (!state.applications || state.applications.length === 0) {
    historySection.style.display = 'none';
    return;
  }

  // Newest first
  const items = [...state.applications].slice().reverse();

  items.forEach(app => {
    const li = document.createElement('li');
    li.className = 'ticket-history-item';

    li.innerHTML = `
      <div class="ticket-line">
        <span class="ticket-id">${app.id}</span>
        <span class="ticket-name">${app.name}</span>
        <span class="ticket-course">${app.course}</span>
        <span class="ticket-time">${new Date(app.submittedAt).toLocaleString()}</span>
      </div>
    `;

    listEl.appendChild(li);
  });

  historySection.style.display = 'block';
}

// --- Form submission ---
form.addEventListener('submit', (e)=>{
  e.preventDefault();
  const formData = new FormData(form);
  const name = formData.get('studentName')?.trim();
  const email = formData.get('email')?.trim();
  const phone = formData.get('phone')?.trim();
  const course = formData.get('course');

  if(!name || !email || !phone || !course){
    showToast('Please fill all required fields');
    return;
  }

  const newApplication = {
    id: 'APP-' + Math.random().toString(36).slice(2,8).toUpperCase(),
    name, email, phone, course,
    submittedAt: new Date().toISOString()
  };

  state.application = newApplication;
  // push into applications list (for history)
  state.applications.push(newApplication);

  // reset stage statuses and timestamps
  state.stages = { verification:'pending', approval:'pending', enrollment:'pending' };
  state.timestamps = { verification:null, approval:null, enrollment:null };

  resetStages();
  saveState();
  updateTicketViewer();
  renderTicketHistory();
  showToast('Application submitted: ' + state.application.id);
});

// --- Verification ---
applyVerificationBtn.addEventListener('click', ()=>{
  if(!state.application){
    showToast('Submit an application first');
    return;
  }
  const action = verificationSelect.value; // verified | rejected | waitlisted
  state.stages.verification = action;
  state.timestamps.verification = new Date().toLocaleString();

  setBadge(statusEls.verification, action);
  metaEls.verification.textContent = {
    verified: 'Documents verified by Admissions Officer',
    rejected: 'Rejected at verification',
    waitlisted: 'Waitlisted at verification'
  }[action] + formatTimestamp(state.timestamps.verification);

  // Gate next stage
  if(action === 'verified'){
    metaEls.approval.textContent =
      'Ready for Dean/Principal review' + formatTimestamp(state.timestamps.approval);
  }else{
    state.stages.approval = 'pending';
    state.stages.enrollment = 'pending';
    state.timestamps.approval = null;
    state.timestamps.enrollment = null;

    setBadge(statusEls.approval, 'pending');
    setBadge(statusEls.enrollment, 'pending');
    metaEls.approval.textContent = 'Requires verified status';
    metaEls.enrollment.textContent = 'Requires approved status';
  }

  updatePipelineProgress();
  saveState();
  updateTicketViewer();
  renderTicketHistory();
  showToast('Verification: ' + action);
});

// --- Approval ---
applyApprovalBtn.addEventListener('click', ()=>{
  if(!state.application){
    showToast('Submit an application first');
    return;
  }
  if(state.stages.verification !== 'verified'){
    showToast('Verification must be completed');
    return;
  }

  const action = approvalSelect.value; // approved | rejected | waitlisted
  state.stages.approval = action;
  state.timestamps.approval = new Date().toLocaleString();

  setBadge(statusEls.approval, action);
  metaEls.approval.textContent = {
    approved: 'Approved by Dean/Principal',
    rejected: 'Rejected at approval',
    waitlisted: 'Waitlisted at approval'
  }[action] + formatTimestamp(state.timestamps.approval);

  // Gate enrollment
  if(action === 'approved'){
    metaEls.enrollment.textContent =
      'Ready for Registrar enrollment' + formatTimestamp(state.timestamps.enrollment);
  }else{
    state.stages.enrollment = 'pending';
    state.timestamps.enrollment = null;

    setBadge(statusEls.enrollment, 'pending');
    metaEls.enrollment.textContent = 'Requires approved status';
  }

  updatePipelineProgress();
  saveState();
  updateTicketViewer();
  renderTicketHistory();
  showToast('Approval: ' + action);
});

// --- Enrollment ---
applyEnrollmentBtn.addEventListener('click', ()=>{
  if(!state.application){
    showToast('Submit an application first');
    return;
  }
  if(state.stages.approval !== 'approved'){
    showToast('Approval must be completed');
    return;
  }

  const action = enrollmentSelect.value; // enrolled | rejected
  state.stages.enrollment = action;
  state.timestamps.enrollment = new Date().toLocaleString();

  setBadge(statusEls.enrollment, action);
  metaEls.enrollment.textContent = {
    enrolled: 'Enrollment completed by Registrar',
    rejected: 'Rejected at enrollment'
  }[action] + formatTimestamp(state.timestamps.enrollment);

  updatePipelineProgress();
  saveState();
  updateTicketViewer();
  renderTicketHistory();
  showToast('Enrollment: ' + action);
});

// --- Reset ---
form.addEventListener('reset', ()=>{
  state.application = null;
  state.stages = { verification:'pending', approval:'pending', enrollment:'pending' };
  state.timestamps = { verification:null, approval:null, enrollment:null };
  resetStages();
  saveState();
  updateTicketViewer();
  // history is kept; do NOT clear state.applications here
  renderTicketHistory();
  showToast('Form reset');
});

// --- Clear saved state button ---
if (clearStateBtn) {
  clearStateBtn.addEventListener('click', clearState);
}

// --- Init ---
loadState();
resetStages();
updateTicketViewer();
renderTicketHistory();
if (state.application) {
  showToast('Resumed application: ' + state.application.id);
}
updatePipelineProgress();
