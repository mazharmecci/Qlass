// --- Storage keys ---
const LEAVE_KEY = 'qlass_student_leave_v1';
const SCHOLARSHIP_KEY = 'qlass_student_scholarship_v1';
const TRANSPORT_KEY = 'qlass_student_transport_v1';

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
// Transport + Map + Bus animation
// ============================
const transportForm = document.getElementById('transportForm');
const transportListEl = document.getElementById('transportList');
const btnNewTransport = document.getElementById('btnNewTransport');
const btnCancelTransport = document.getElementById('btnCancelTransport');

let map;
let transportLayer;
let busMarker;
let busAnimationTimer = null;

// --- UI helpers ---
function toggleTransportForm(show) {
  if (!transportForm) return;
  transportForm.classList.toggle('hidden', !show);
  if (!show) transportForm.reset();
}

// --- Event wiring ---
btnNewTransport?.addEventListener('click', () => toggleTransportForm(true));
btnCancelTransport?.addEventListener('click', () => toggleTransportForm(false));

transportForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const record = buildTransportRecord();
  if (!record) return;

  const records = getData(TRANSPORT_KEY);
  records.push(record);
  saveData(TRANSPORT_KEY, records);

  toggleTransportForm(false);
  renderTransport();
  plotTransportOnMap();
});

// --- Record builder ---
function parseLatLngPair(value) {
  if (!value) return null;
  const parts = value.split(',').map(p => parseFloat(p.trim()));
  if (parts.length !== 2 || parts.some(isNaN)) return null;
  return [parts[0], parts[1]];
}

function buildTransportRecord() {
  const routeName = document.getElementById('routeName').value.trim();
  const busNo = document.getElementById('busNo').value.trim();
  const pickup = document.getElementById('pickup').value.trim();
  const drop = document.getElementById('drop').value.trim();
  const fromLatLng = document.getElementById('fromLatLng').value.trim();
  const toLatLng = document.getElementById('toLatLng').value.trim();

  if (!routeName) {
    alert('Route name is required.');
    return null;
  }

  const from = parseLatLngPair(fromLatLng);
  const to = parseLatLngPair(toLatLng);

  if (!from || !to) {
    alert('Please enter valid From/To coordinates as "lat,lng".');
    return null;
  }

  const path = [from, to];

  return {
    id: `TR-${Date.now()}`,
    routeName,
    busNo,
    pickup,
    drop,
    path,
    lat: from[0],
    lng: from[1],
    createdAt: new Date().toISOString()
  };
}

// --- List rendering ---
function renderTransport() {
  const records = getData(TRANSPORT_KEY);
  transportListEl.innerHTML = '';

  if (!records.length) {
    transportListEl.innerHTML =
      '<li class="ticket-item empty">No transport records yet.</li>';
    return;
  }

  records
    .slice()
    .reverse()
    .forEach(record => {
      const li = document.createElement('li');
      li.className = 'ticket-item';
      li.dataset.routeId = record.id;

      li.innerHTML = `
        <div class="ticket-line">
          <span><strong>${record.routeName}</strong></span>
          <span>${record.busNo || ''}</span>
        </div>
        <div class="ticket-line">
          <span>${record.pickup || ''} → ${record.drop || ''}</span>
          <span>${new Date(record.createdAt).toLocaleString()}</span>
        </div>
        <div class="ticket-line">
          <button class="btn btn-sm btn-outline-secondary js-route-play">
            ▶ View Route
          </button>
          <button class="btn btn-sm btn-outline-secondary js-route-delete">
            🗑 Delete
          </button>
        </div>
      `;

      // play route (fit/animate)
      li.querySelector('.js-route-play').addEventListener('click', () => {
        if (Array.isArray(record.path) && record.path.length >= 2) {
          animateBus(record.path); // or map.fitBounds(record.path, { padding: [40, 40] });
        } else {
          alert('No path data available for this route.');
        }
      });

      // delete route
      li.querySelector('.js-route-delete').addEventListener('click', () => {
        deleteTransportRecord(record.id);
      });

      transportListEl.appendChild(li);
    });
}

function deleteTransportRecord(id) {
  const confirmDelete = confirm('Delete this transport route?');
  if (!confirmDelete) return;

  const records = getData(TRANSPORT_KEY);
  const updated = records.filter(r => r.id !== id);
  saveData(TRANSPORT_KEY, updated);
  renderTransport();
  plotTransportOnMap();
}

// --- Map + layers ---
function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl || typeof L === 'undefined') return;

  // center between the two points
  map = L.map('map').setView([12.9227, 77.5690], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  transportLayer = L.layerGroup().addTo(map);
  plotTransportOnMap();
}

function plotTransportOnMap() {
  if (!map || !transportLayer) return;

  transportLayer.clearLayers();
  const records = getData(TRANSPORT_KEY);

  records.forEach(record => {
    if (Array.isArray(record.path) && record.path.length >= 2) {
      L.polyline(record.path, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.8
      }).addTo(transportLayer);
    }

    if (typeof record.lat === 'number' && typeof record.lng === 'number') {
      L.marker([record.lat, record.lng])
        .addTo(transportLayer)
        .bindPopup(`${record.routeName}<br>${record.busNo || ''}`);
    }
  });
}

// --- Bus animation ---
function animateBus(path) {
  if (!map || !Array.isArray(path) || path.length < 2) return;

  if (busAnimationTimer) {
    clearInterval(busAnimationTimer);
    busAnimationTimer = null;
  }
  if (busMarker) {
    map.removeLayer(busMarker);
  }

  let index = 0;
  busMarker = L.marker(path[0], { title: 'Bus' }).addTo(map);
  map.fitBounds(path, { padding: [40, 40] });

  busAnimationTimer = setInterval(() => {
    index++;
    if (index >= path.length) {
      clearInterval(busAnimationTimer);
      busAnimationTimer = null;
      return;
    }
    busMarker.setLatLng(path[index]);
  }, 1000);
}

if (typeof L !== 'undefined') {
  const defaultIconUrl =
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
  const defaultIcon2xUrl =
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
  const defaultShadowUrl =
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

  L.Icon.Default.mergeOptions({
    iconUrl: defaultIconUrl,
    iconRetinaUrl: defaultIcon2xUrl,
    shadowUrl: defaultShadowUrl
  });
}

// ============================
// Init
// ============================
renderLeave();
renderScholarships();
renderTransport();
initMap();
