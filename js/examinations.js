// --- Global constants for exams + admissions ---
const EXAMS_KEY = 'qlass_exams_state_v1';
const ADMISSIONS_KEY = 'qlass_admissions_state_v2';

// --- Helpers ---
function getExams() {
  const raw = localStorage.getItem(EXAMS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveExams(exams) {
  localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
}

function getEnrolledStudents(course) {
  const raw = localStorage.getItem(ADMISSIONS_KEY);
  if (!raw) return [];
  const all = JSON.parse(raw);
  // adjust field names if your admissions object differs
  return all.filter(app => app.course === course && app.studentId);
}

// Build a hydrated exam with attendance + marks
function addExam(examObj) {
  const students = getEnrolledStudents(examObj.course);

  const attendance = students.map(app => ({
    studentId: app.studentId,
    studentName: app.studentName || '',
    status: 'Present',
    timestamp: null
  }));

  const marks = students.map(app => ({
    studentId: app.studentId,
    studentName: app.studentName || '',
    marksObtained: null,
    maxMarks: 100,
    grade: ''
  }));

  const exam = {
    ...examObj,
    attendance,
    marks,
    results: []
  };

  const exams = getExams();
  exams.push(exam);
  saveExams(exams);
  renderExamList();
}

// --- Render exam list ---
function renderExamList() {
  const exams = getExams();
  const q = (document.getElementById('examSearch')?.value || '').trim().toLowerCase();

  if (!exams.length) {
    examList.innerHTML = `<li class="ticket-item empty">No exams scheduled yet.</li>`;
    return;
  }

  const filtered = exams.filter(exam => {
    const course = (exam.course || '').toLowerCase();
    const subject = (exam.subject || '').toLowerCase();
    const examId = (exam.examId || '').toLowerCase();
    if (!q) return true;
    return course.includes(q) || subject.includes(q) || examId.includes(q);
  });

  if (!filtered.length) {
    examList.innerHTML = `<li class="ticket-item empty">No exams match your search/filter.</li>`;
    return;
  }

  examList.innerHTML = filtered.map(exam => {
    const statusClass = exam.status === 'Scheduled' ? 'status-scheduled'
                      : exam.status === 'Completed' ? 'status-completed'
                      : 'status-cancelled';

    const attendanceRows = (exam.attendance || []).map(a => `
      <tr>
        <td>
          ${a.studentId}
          ${a.studentName ? `<div class="sub-label">${a.studentName}</div>` : ''}
        </td>
        <td>
          <select class="attendance-select" data-student-id="${a.studentId}" data-exam-id="${exam.examId}">
            <option value="Present" ${a.status === 'Present' ? 'selected' : ''}>Present</option>
            <option value="Absent" ${a.status === 'Absent' ? 'selected' : ''}>Absent</option>
            <option value="Medical" ${a.status === 'Medical' ? 'selected' : ''}>Medical</option>
          </select>
        </td>
      </tr>
    `).join('');

    const marksRows = (exam.marks || []).map(m => `
      <tr>
        <td>
          ${m.studentId}
          ${m.studentName ? `<div class="sub-label">${m.studentName}</div>` : ''}
        </td>
        <td>
          <input
            type="number"
            min="0"
            class="marks-input"
            data-student-id="${m.studentId}"
            data-exam-id="${exam.examId}"
            value="${m.marksObtained ?? ''}"
          />
        </td>
        <td>${m.maxMarks || 100}</td>
        <td>${m.grade || ''}</td>
      </tr>
    `).join('');

    const hasResults = (exam.results || []).length > 0;

    const resultsRows = (exam.results || []).map(r => `
      <tr>
        <td>${r.studentId}</td>
        <td>${r.totalMarks}</td>
        <td>${r.percentage.toFixed(2)}%</td>
        <td>${r.grade}</td>
        <td>${r.status}</td>
        <td>${new Date(r.approvedOn).toLocaleString()}</td>
      </tr>
    `).join('');

    return `
      <li class="ticket-item" data-id="${exam.examId}">
        <div class="ticket-line ticket-line-top">
          <span class="ticket-top-summary">
            ${exam.examId} • ${exam.course} • ${exam.subject} (${exam.examType})
          </span>
        </div>

        <div class="ticket-line exam-summary">
          <span class="summary-pill">Date: ${new Date(exam.date).toLocaleString()}</span>
          <span class="summary-pill">Venue: ${exam.venue || '—'}</span>
          <span class="summary-pill">Invigilators: ${(exam.invigilators || []).join(', ') || '—'}</span>
          <span class="exam-status ${statusClass}">Status: ${exam.status}</span>
        </div>

        <div class="exam-attendance exam-section">
          <h4>Attendance</h4>
          <table class="exam-table">
            <thead><tr><th>Student</th><th>Status</th></tr></thead>
            <tbody>${attendanceRows || '<tr><td colspan="2">No attendance yet</td></tr>'}</tbody>
          </table>
        </div>

        <div class="exam-marks exam-section">
          <h4>Marks</h4>
          <table class="exam-table">
            <thead><tr><th>Student</th><th>Marks</th><th>Max</th><th>Grade</th></tr></thead>
            <tbody>${marksRows || '<tr><td colspan="4">No marks recorded yet</td></tr>'}</tbody>
          </table>
        </div>

        ${hasResults ? `
        <div class="exam-results exam-section">
          <h4>Results</h4>
          <table class="exam-table">
            <thead>
              <tr>
                <th>Student</th><th>Marks</th><th>%</th><th>Grade</th><th>Status</th><th>Approved On</th>
              </tr>
            </thead>
            <tbody>${resultsRows}</tbody>
          </table>
        </div>` : `
        <div class="exam-results exam-section">
          <h4>Results</h4>
          <p class="empty-text">No results compiled yet.</p>
        </div>`}

        <div class="ticket-line exam-actions">
          <button class="btn btn-primary btn-sm" data-action="save-attendance" data-exam-id="${exam.examId}">
            Save Attendance
          </button>
          <button class="btn btn-outline-info btn-sm" data-action="save-marks" data-exam-id="${exam.examId}">
            Save Marks
          </button>
          <button class="btn btn-outline-success btn-sm" data-action="compile-results" data-exam-id="${exam.examId}">
            Compile Results
          </button>
        </div>
      </li>
    `;
  }).join('');
}

// --- Action Handlers ---
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const examId = btn.dataset.examId;
  if (!examId) return;

  const exams = getExams();
  const exam = exams.find(ex => ex.examId === examId);
  if (!exam) return;

  if (action === 'save-attendance') {
    const selects = document.querySelectorAll(`.attendance-select[data-exam-id="${examId}"]`);
    exam.attendance = Array.from(selects).map(sel => ({
      studentId: sel.dataset.studentId,
      status: sel.value,
      timestamp: new Date().toISOString()
    }));
    saveExams(exams);
    alert('Attendance saved!');
  }

  if (action === 'save-marks') {
    const inputs = document.querySelectorAll(`.marks-input[data-exam-id="${examId}"]`);
    exam.marks = Array.from(inputs).map(inp => {
      const marksObtained = inp.value === '' ? null : Number(inp.value);
      const maxMarks = 100;
      const percentage = marksObtained == null ? 0 : (marksObtained / maxMarks) * 100;
      let grade = '';
      if (marksObtained != null) {
        if (percentage >= 85) grade = 'A';
        else if (percentage >= 70) grade = 'B';
        else if (percentage >= 50) grade = 'C';
        else grade = 'D';
      }
      return {
        studentId: inp.dataset.studentId,
        marksObtained,
        maxMarks,
        grade
      };
    });
    saveExams(exams);
    alert('Marks saved!');
    renderExamList();
  }

  if (action === 'compile-results') {
    exam.results = (exam.marks || []).map(m => {
      const totalMarks = m.marksObtained ?? 0;
      const percentage = m.marksObtained == null
        ? 0
        : (m.marksObtained / (m.maxMarks || 100)) * 100;
      const grade = m.grade || '';
      return {
        studentId: m.studentId,
        examId: exam.examId,
        totalMarks,
        percentage,
        grade,
        status: grade && grade !== 'D' ? 'Pass' : 'Fail',
        approvedOn: new Date().toISOString()
      };
    });
    exam.status = 'Completed';
    saveExams(exams);
    alert('Results compiled!');
    renderExamList();
  }
});

// --- Wire up search ---
document.getElementById('examSearch')?.addEventListener('input', renderExamList);

// --- Exam form handlers ---
const btnScheduleExam = document.getElementById('btnScheduleExam');
const examFormSection = document.getElementById('examFormSection');
const examForm = document.getElementById('examForm');
const btnCancelExam = document.getElementById('btnCancelExam');

btnScheduleExam?.addEventListener('click', () => {
  examFormSection.classList.remove('hidden');
});

btnCancelExam?.addEventListener('click', () => {
  examFormSection.classList.add('hidden');
  examForm.reset();
});

examForm?.addEventListener('submit', (e) => {
  e.preventDefault();

  const examObj = {
    examId: document.getElementById('examId').value.trim(),
    course: document.getElementById('examCourse').value.trim(),
    subject: document.getElementById('examSubject').value.trim(),
    examType: document.getElementById('examType').value,
    date: document.getElementById('examDate').value,
    venue: document.getElementById('examVenue').value.trim(),
    invigilators: document.getElementById('examInvigilators').value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
    status: 'Scheduled'
  };

  addExam(examObj);

  examFormSection.classList.add('hidden');
  examForm.reset();
  alert('Exam scheduled successfully!');
});

// --- Initial render ---
renderExamList();
