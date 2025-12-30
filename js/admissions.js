// Qlass/js/admissions.js

// --- In-memory state ---
const state = {
  application: null,   // current / active application
  applications: [],    // future: support multiple applications
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
  // push into applications list (for future multi-application UI)
  state.applications.push(newApplication);

  // reset stage statuses and timestamps
  state.stages = { verification:'pending', approval:'pending', enrollment:'pending' };
  state.timestamps = { verification:null, approval:null, enrollment:null };

  resetStages();
  saveState();
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
  showToast('Enrollment: ' + action);
});

// --- Reset ---
form.addEventListener('reset', ()=>{
  state.application = null;
  state.stages = { verification:'pending', approval:'pending', enrollment:'pending' };
  state.timestamps = { verification:null, approval:null, enrollment:null };
  resetStages();
  saveState();
  showToast('Form reset');
});

// --- Clear saved state button ---
if (clearStateBtn) {
  clearStateBtn.addEventListener('click', clearState);
}

// --- Init ---
loadState();
resetStages();
if (state.application) {
  showToast('Resumed application: ' + state.application.id);
}
updatePipelineProgress();
