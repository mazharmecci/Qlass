// Qlass/js/admissions.js

// --- In-memory state ---
const state = {
  application: null,        // currently selected application
  applications: [],         // all applications (history)
  stages: {
    verification: 'pending',
    approval: 'pending',
    enrollment: 'pending'
  },
  timestamps: {
    verification: null,
    approval: null,
    enrollment: null
  }
};

// --- Persistence (localStorage) ---
const STORAGE_KEY = 'qlass_admissions_state_v2';

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

    // Normalize applications with embedded stages+timestamps
    state.applications = Array.isArray(parsed.applications) ? parsed.applications : [];
    state.applications = state.applications.map(app => ({
      ...app,
      stages: Object.assign(
        { verification: 'pending', approval: 'pending', enrollment: 'pending' },
        app.stages || {}
      ),
      timestamps: Object.assign(
        { verification: null, approval: null, enrollment: null },
        app.timestamps || {}
      )
    }));

    // Restore current application by ID if present
    let current = null;
    if (parsed.application && parsed.application.id) {
      current = state.applications.find(a => a.id === parsed.application.id) || null;
    }

    state.application = current;
    if (current) {
      state.stages = { ...current.stages };
      state.timestamps = { ...current.timestamps };
    } else {
      state.stages = { verification: 'pending', approval: 'pending', enrollment: 'pending' };
      state.timestamps = { verification: null, approval: null, enrollment: null };
    }
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
  saveState();
  updateTicketViewer();
  renderTicketHistory();
  updateSnapshot();
  showToast('Saved state cleared');
}

// --- Elements ---
const form = document.getElementById('applicationForm');
const toast = document.getElementById('toast');
const pipelineFill = document.getElementById('pipelineFill');
const clearStateBtn = document.getElementById('clearState');
const historyListEl = document.getElementById('ticketHistoryList');

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
const ticketSearchInput = document.getElementById('ticketSearch');

// --- Live search above admissions history ---

if (ticketSearchInput) {
  ticketSearchInput.addEventListener('input', () => {
    renderTicketHistory();
  });
}

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
    metaEls.verification.textContent = 'Awaiting submission';
    metaEls.approval.textContent = 'Requires verified status';
    metaEls.enrollment.textContent = 'Requires approved status';
  }

  updatePipelineProgress();
}
let courseFilter = null; // when set, history shows only that course

// --- Ticket viewer (current application) ---
function updateTicketViewer() {
  const viewer = document.getElementById('ticketViewer');
  const summary = document.getElementById('ticketSummary');

  if (!viewer || !summary) return;

  if (!state.application) {
    viewer.style.display = 'none';
    summary.innerHTML = '';
    return;
  }

  const s = state.stages;
  const stage = s.enrollment !== 'pending'
    ? 'Enrollment'
    : s.approval !== 'pending'
    ? 'Approval'
    : s.verification !== 'pending'
    ? 'Verification'
    : 'Not started';

  const status = s.enrollment !== 'pending'
    ? s.enrollment
    : s.approval !== 'pending'
    ? s.approval
    : s.verification !== 'pending'
    ? s.verification
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

// --- Ticket dashboard ---
function updateSnapshot() {
  const snapSection = document.getElementById('admissionSnapshot');
  if (!snapSection) return;

  const totalEl      = document.getElementById('snapTotal');
  const verEl        = document.getElementById('snapVerified');
  const apprEl       = document.getElementById('snapApproved');
  const enrEl        = document.getElementById('snapEnrolled');
  const rejEl        = document.getElementById('snapRejected');
  const yearEl       = document.getElementById('snapThisYear');
  const byCourseWrap = document.getElementById('snapByCourse');

  const apps = state.applications || [];
  if (!apps.length) {
    snapSection.style.display = 'none';
    return;
  }

  const nowYear = new Date().getFullYear();
  let total = 0, verified = 0, approved = 0, enrolled = 0, rejected = 0, thisYear = 0;
  const courseCounts = {};

  apps.forEach(app => {
    total++;

    const s = app.stages || {};
    if (s.verification === 'verified') verified++;
    if (s.approval === 'approved') approved++;
    if (s.enrollment === 'enrolled') enrolled++;

    if (s.verification === 'rejected' || s.approval === 'rejected' || s.enrollment === 'rejected') {
      rejected++;
    }

    const submittedYear = app.submittedAt ? new Date(app.submittedAt).getFullYear() : null;
    if (submittedYear === nowYear) thisYear++;

    const key = app.course || 'Unknown';
    courseCounts[key] = (courseCounts[key] || 0) + 1;
  });

  if (totalEl) totalEl.textContent = total;
  if (verEl)   verEl.textContent = verified;
  if (apprEl)  apprEl.textContent = approved;
  if (enrEl)   enrEl.textContent = enrolled;
  if (rejEl)   rejEl.textContent = rejected;
  if (yearEl)  yearEl.textContent = thisYear;

  
  if (byCourseWrap) {
    byCourseWrap.innerHTML = '';
    Object.entries(courseCounts)
      .sort((a,b) => b[1] - a[1])
      .slice(0, 6)
      .forEach(([course, count]) => {
        const span = document.createElement('span');
        span.className = 'snapshot-chip';
        span.dataset.course = course;
        if (courseFilter === course) {
          span.classList.add('active');
        }
        span.textContent = `${course}: ${count}`;
        byCourseWrap.appendChild(span);
      });
  }

  snapSection.style.display = 'block';
}

// --- Ticket history helpers ---
function getTicketStatusSummary(app) {
  const s = app.stages;
  if (s.enrollment !== 'pending') return 'Enrollment: ' + s.enrollment;
  if (s.approval !== 'pending') return 'Approval: ' + s.approval;
  if (s.verification !== 'pending') return 'Verification: ' + s.verification;
  return 'Pending';
}

function renderTicketHistory() {
  const historySection = document.getElementById('ticketHistory');
  const listEl = document.getElementById('ticketHistoryList');
  if (!historySection || !listEl) return;

  listEl.innerHTML = '';

  if (!state.applications.length) {
    historySection.style.display = 'none';
    return;
  }

  const query = ticketSearchInput ? ticketSearchInput.value.trim().toLowerCase() : '';
  let items = [...state.applications].slice().reverse(); // newest first

  // text search filter
  if (query) {
    items = items.filter(app => {
      const id = app.id.toLowerCase();
      const name = (app.name || '').toLowerCase();
      return id.includes(query) || name.includes(query);
    });
  }

  // course pill filter
  if (courseFilter) {
    items = items.filter(app => (app.course || '') === courseFilter);
  }

  if (!items.length) {
    listEl.innerHTML = '<li class="ticket-history-item empty">No tickets match your filters.</li>';
    historySection.style.display = 'block';
    return;
  }

  items.forEach(app => {
    const li = document.createElement('li');
    li.className = 'ticket-history-item';
    li.dataset.ticketId = app.id;

    const isActive = state.application && state.application.id === app.id;
    if (isActive) li.classList.add('active');

    li.innerHTML = `
      <div class="ticket-line">
        <span class="ticket-id">${app.id}</span>
        <span class="ticket-name">${app.name}</span>
        <span class="ticket-course">${app.course}</span>
        <span class="ticket-status-pill">${getTicketStatusSummary(app)}</span>
        <span class="ticket-time">${new Date(app.submittedAt).toLocaleString()}</span>
      </div>
    `;

    listEl.appendChild(li);
  });

  historySection.style.display = 'block';
}

function setCurrentApplicationById(ticketId) {
  const found = state.applications.find(app => app.id === ticketId);
  if (!found) return;

  state.application = found;
  state.stages = { ...found.stages };
  state.timestamps = { ...found.timestamps };

  resetStages();
  updateTicketViewer();
  renderTicketHistory();
  saveState();
  showToast('Switched to application: ' + found.id);
}

function updateBodyTicketActiveFlag() {
  if (state.application) {
    document.body.classList.add('ticket-active');
  } else {
    document.body.classList.remove('ticket-active');
  }
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
    submittedAt: new Date().toISOString(),
    stages: {
      verification: 'pending',
      approval: 'pending',
      enrollment: 'pending'
    },
    timestamps: {
      verification: null,
      approval: null,
      enrollment: null
    }
  };

  state.application = newApplication;
  state.applications.push(newApplication);

  state.stages = { ...newApplication.stages };
  state.timestamps = { ...newApplication.timestamps };

  resetStages();
  saveState();
  updateTicketViewer();
  renderTicketHistory();
  updateSnapshot();
  showToast('Application submitted: ' + state.application.id);

  // Clear form fields visually
  form.reset();
});

// --- Update current app helper ---
function syncCurrentApplicationToArray() {
  if (!state.application) return;
  const idx = state.applications.findIndex(a => a.id === state.application.id);
  if (idx !== -1) {
    state.applications[idx] = {
      ...state.application,
      stages: { ...state.stages },
      timestamps: { ...state.timestamps }
    };
  }
}

const snapByCourseWrap = document.getElementById('snapByCourse');
if (snapByCourseWrap) {
  snapByCourseWrap.addEventListener('click', (e) => {
    const chip = e.target.closest('.snapshot-chip');
    if (!chip) return;

    const course = chip.dataset.course;
    // Toggle: clicking same chip again clears filter
    if (courseFilter === course) {
      courseFilter = null;
    } else {
      courseFilter = course;
    }

    // re-render pills to update active class
    updateSnapshot();
    // re-render history with new filter
    renderTicketHistory();
  });
}

// --- Verification ---
applyVerificationBtn.addEventListener('click', ()=>{
  if(!state.application){
    showToast('Submit an application first');
    return;
  }
  const action = verificationSelect.value;
  state.stages.verification = action;
  state.timestamps.verification = new Date().toLocaleString();

  setBadge(statusEls.verification, action);
  metaEls.verification.textContent = {
    verified: 'Documents verified by Admissions Officer',
    rejected: 'Rejected at verification',
    waitlisted: 'Waitlisted at verification'
  }[action] + formatTimestamp(state.timestamps.verification);

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

  syncCurrentApplicationToArray();
  updatePipelineProgress();
  saveState();
  updateTicketViewer();
  renderTicketHistory();
  updateSnapshot();
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

  const action = approvalSelect.value;
  state.stages.approval = action;
  state.timestamps.approval = new Date().toLocaleString();

  setBadge(statusEls.approval, action);
  metaEls.approval.textContent = {
    approved: 'Approved by Dean/Principal',
    rejected: 'Rejected at approval',
    waitlisted: 'Waitlisted at approval'
  }[action] + formatTimestamp(state.timestamps.approval);

  if(action === 'approved'){
    metaEls.enrollment.textContent =
      'Ready for Registrar enrollment' + formatTimestamp(state.timestamps.enrollment);
  }else{
    state.stages.enrollment = 'pending';
    state.timestamps.enrollment = null;

    setBadge(statusEls.enrollment, 'pending');
    metaEls.enrollment.textContent = 'Requires approved status';
  }

  syncCurrentApplicationToArray();
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

  const action = enrollmentSelect.value;
  state.stages.enrollment = action;
  state.timestamps.enrollment = new Date().toLocaleString();

  setBadge(statusEls.enrollment, action);
  metaEls.enrollment.textContent = {
    enrolled: 'Enrollment completed by Registrar',
    rejected: 'Rejected at enrollment'
  }[action] + formatTimestamp(state.timestamps.enrollment);

  syncCurrentApplicationToArray();
  updatePipelineProgress();
  saveState();
  updateTicketViewer();
  renderTicketHistory();
  showToast('Enrollment: ' + action);
});

// --- Reset ---
form.addEventListener('reset', ()=>{
  // Do not clear history; just clear current in-memory stages
  state.application = null;
  state.stages = { verification:'pending', approval:'pending', enrollment:'pending' };
  state.timestamps = { verification:null, approval:null, enrollment:null };
  resetStages();
  saveState();
  updateTicketViewer();
  renderTicketHistory();
  showToast('Form reset');
});

// --- Clear saved state button ---
if (clearStateBtn) {
  clearStateBtn.addEventListener('click', clearState);
}

// --- Ticket History click (select ticket) ---
if (historyListEl) {
  historyListEl.addEventListener('click', (e) => {
    const li = e.target.closest('.ticket-history-item');
    if (!li) return;
    const id = li.dataset.ticketId;
    setCurrentApplicationById(id);
  });
}

// --- Init ---
loadState();
resetStages();
updateTicketViewer();
renderTicketHistory();
updateSnapshot();
if (state.application) {
  showToast('Resumed application: ' + state.application.id);
}
updatePipelineProgress();
