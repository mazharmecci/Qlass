// Qlass/js/admissions.js

const state = {
  application: null,
  stages: { verification: 'pending', approval: 'pending', enrollment: 'pending' }
};

// Elements
const form = document.getElementById('applicationForm');
const toast = document.getElementById('toast');
const pipelineFill = document.getElementById('pipelineFill');

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

// Helpers
function showToast(message){
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(()=> toast.classList.remove('show'), 1800);
}
function setBadge(el, status){
  el.className = 'status-badge ' + status;
  el.textContent = status[0].toUpperCase() + status.slice(1);
}
function updatePipelineProgress(){
  let progress = 0;
  if(state.stages.verification === 'verified') progress = 33;
  if(state.stages.approval === 'approved') progress = 66;
  if(state.stages.enrollment === 'enrolled') progress = 100;
  pipelineFill.style.width = progress + '%';
}
function resetStages(){
  state.stages = { verification:'pending', approval:'pending', enrollment:'pending' };
  setBadge(statusEls.verification, 'pending');
  setBadge(statusEls.approval, 'pending');
  setBadge(statusEls.enrollment, 'pending');
  metaEls.verification.textContent = state.application ? 'Submitted: awaiting verification' : 'Awaiting submission';
  metaEls.approval.textContent = 'Requires verified status';
  metaEls.enrollment.textContent = 'Requires approved status';
  updatePipelineProgress();
}

// Form submission
form.addEventListener('submit', e=>{
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

  state.application = {
    id: 'APP-' + Math.random().toString(36).slice(2,8).toUpperCase(),
    name, email, phone, course,
    submittedAt: new Date().toISOString()
  };

  resetStages();
  showToast('Application submitted: ' + state.application.id);
});

// Verification
applyVerificationBtn.addEventListener('click', ()=>{
  if(!state.application){ showToast('Submit an application first'); return; }
  const action = verificationSelect.value;
  state.stages.verification = action;
  setBadge(statusEls.verification, action);
  metaEls.verification.textContent = {
    verified:'Documents verified by Admissions Officer',
    rejected:'Rejected at verification',
    waitlisted:'Waitlisted at verification'
  }[action];

  if(action === 'verified'){
    metaEls.approval.textContent = 'Ready for Dean/Principal review';
  } else {
    state.stages.approval = 'pending';
    state.stages.enrollment = 'pending';
    setBadge(statusEls.approval, 'pending');
    setBadge(statusEls.enrollment, 'pending');
    metaEls.approval.textContent = 'Requires verified status';
    metaEls.enrollment.textContent = 'Requires approved status';
  }
  updatePipelineProgress();
  showToast('Verification: ' + action);
});

// Approval
applyApprovalBtn.addEventListener('click', ()=>{
  if
