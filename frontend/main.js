const API_BASE_URL = 'http://localhost:8080'; // Your Java backend base URL

document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const loginBtn = document.getElementById('loginBtn');
  const errorMsg = document.getElementById('errorMsg');
  const successMsg = document.getElementById('successMsg');

  errorMsg.style.display = 'none';
  successMsg.style.display = 'none';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    errorMsg.style.display = 'block';
    errorMsg.textContent = 'Please fill in all fields';
    return;
  }

  loginBtn.innerHTML = '<span class="spinner"></span>Logging in...';
  loginBtn.classList.add('loading');

  // Hardcoded fallback dataset (keep for offline/demo)
  const doctorsDataset = [
    { email: 'doctor1@example.com', password: 'pass123', fullName: 'Dr. Alice' },
    { email: 'doctor2@example.com', password: 'password', fullName: 'Dr. Bob' }
  ];

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      if (data.token) {
        sessionStorage.setItem('authToken', data.token);
      }
      if (data.user) {
        sessionStorage.setItem('user', JSON.stringify(data.user));
      }
      sessionStorage.setItem('userEmail', email);
      sessionStorage.setItem('isLoggedIn', 'true');
      successMsg.style.display = 'block';
      successMsg.textContent = 'Login successful! Redirecting...';
      setTimeout(() => {
        window.location.href = 'main.html'; // Your dashboard page
      }, 1000);
    } else {
      errorMsg.style.display = 'block';
      errorMsg.textContent = data.message || 'Invalid email or password';
    }
  } catch (error) {
    // Backend unreachable - use fallback dataset
    const localMatch = doctorsDataset.find(d => d.email === email && d.password === password);
    if (localMatch) {
      sessionStorage.setItem('userEmail', email);
      sessionStorage.setItem('user', JSON.stringify({ fullName: localMatch.fullName }));
      sessionStorage.setItem('isLoggedIn', 'true');
      successMsg.style.display = 'block';
      successMsg.textContent = 'Login successful (local fallback)! Redirecting...';
      setTimeout(() => {
        window.location.href = 'main.html';
      }, 1000);
    } else {
      errorMsg.style.display = 'block';
      errorMsg.textContent = 'Unable to connect to server and invalid credentials.';
    }
  } finally {
    loginBtn.innerHTML = 'Log In';
    loginBtn.classList.remove('loading');
  }
});

// Existing checkAuth function in your main.html remains unchanged (calls on page load).
function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    if (isLoggedIn !== 'true') {
        window.location.href = 'login.html';
        return;
    }
    const user = sessionStorage.getItem('user');
    const email = sessionStorage.getItem('userEmail');
    let displayName = 'Doctor';
    if (user) {
        try {
            const userData = JSON.parse(user);
            displayName = userData.fullName || userData.name || email || 'Doctor';
        } catch (e) {
            displayName = email || 'Doctor';
        }
    } else if (email) {
        displayName = email;
    }
    document.getElementById('docNameDisplay').textContent = displayName;
    document.getElementById('welcome-doctor-name').textContent = `Welcome, ${displayName}`;
}

// Call checkAuth before anything else
checkAuth();

// AUTH CHECK - Redirect to login if not authenticated
(function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    /*if (isLoggedIn !== 'true') {
        window.location.href = 'login.html';
        return;
    }*/
    // Display doctor name if available
    const user = sessionStorage.getItem('user');
    const email = sessionStorage.getItem('userEmail');
    let displayName = 'Doctor';
    if (user) {
        try {
            const userData = JSON.parse(user);
            displayName = userData.fullName || userData.name || email || 'Doctor';
        } catch (e) {
            displayName = email || 'Doctor';
        }
    } else if (email) {
        displayName = email;
    }
    document.getElementById('doctor-name-display').textContent = displayName;
    document.getElementById('welcome-doctor-name').textContent = `Welcome, ${displayName}`;
})();

let patients = [];
let editingIndex = null;
let filteredPatients = null;
let ecgResultPatientIdx = null;

const navWelcome = document.getElementById('nav-welcome');
const navDoctor = document.getElementById('nav-doctor');
const navMedical = document.getElementById('nav-medical');
const welcomeSection = document.getElementById('welcome-section');
const doctorSection = document.getElementById('doctor-section');
const medicalRecordsSection = document.getElementById('medical-records-section');
const addBtn = document.getElementById('add-patient');
const addModal = document.getElementById('addPatientModal');
const closeAddModal = document.getElementById('closeModal');
const addForm = document.getElementById('addPatientForm');
const patientList = document.getElementById('patient-list');
const submitBtn = document.getElementById('addPatientFormBtn');
const medicalRecordsList = document.getElementById('medical-records-list');
const viewPatientModal = document.getElementById('viewPatientModal');
const closeViewModal = document.getElementById('closeViewModal');
const logoutBtn = document.getElementById('logout-btn');
const sessionTerminatedSection = document.getElementById('session-terminated-section');
const ecgResultSection = document.getElementById('ecg-result-section');
const mainSections = [welcomeSection, doctorSection, medicalRecordsSection];
const patientSearchInput = document.getElementById('patient-search');
const searchBtn = document.getElementById('search-btn');
const ecgResultName = document.getElementById('ecgResultName');
const ecgResultPhone = document.getElementById('ecgResultPhone');
const ecgResultAge = document.getElementById('ecgResultAge');
const ecgResultHistory = document.getElementById('ecgResultHistory');
const ecgResultDescription = document.getElementById('ecgResultDescription');
const ecgResultBackBtn = document.getElementById('ecgResultBackBtn');
const ecgResultSaveBtn = document.getElementById('ecgResultSaveBtn');

function activateTab(tab) {
    navWelcome.classList.remove('active');
    navDoctor.classList.remove('active');
    navMedical.classList.remove('active');
    welcomeSection.style.display = 'none';
    doctorSection.style.display = 'none';
    medicalRecordsSection.style.display = 'none';
    ecgResultSection.style.display = 'none';
    tab.classList.add('active');
}
navWelcome.onclick = (e) => { e.preventDefault(); activateTab(navWelcome); welcomeSection.style.display = ''; };
navDoctor.onclick = (e) => { e.preventDefault(); activateTab(navDoctor); doctorSection.style.display = ''; };
navMedical.onclick = (e) => { e.preventDefault(); activateTab(navMedical); medicalRecordsSection.style.display = ''; };
activateTab(navWelcome);
welcomeSection.style.display = '';

// LOGOUT - Clear session and redirect
logoutBtn.onclick = () => {
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('userEmail');
    sessionStorage.removeItem('isLoggedIn');
    document.querySelector("nav").style.display = "none";
    mainSections.forEach(section => section.style.display = "none");
    addModal.style.display = 'none';
    viewPatientModal.style.display = 'none';
    ecgResultSection.style.display = 'none';
    sessionTerminatedSection.style.display = 'block';
};

addBtn.onclick = () => { editingIndex = null; addForm.reset(); submitBtn.textContent = 'Save Patient'; addModal.style.display = 'flex'; };
closeAddModal.onclick = () => { addModal.style.display = 'none'; };
closeViewModal.onclick = () => { viewPatientModal.style.display = 'none'; };

function filterPatients(query) {
    const q = query.toLowerCase();
    return patients.filter(p =>
        p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q) || p.address?.toLowerCase().includes(q) ||
        p.gender?.toLowerCase().includes(q) || p.age?.toString().includes(q)
    );
}
function updatePatientListUI() {
    let list = filteredPatients !== null ? filteredPatients : patients;
    patientList.innerHTML = '';
    if (list.length === 0) { patientList.innerHTML = '<p>No patients found.</p>'; return; }
    list.forEach((patient) => {
        const origIdx = patients.indexOf(patient);
        const card = document.createElement('div');
        card.className = 'patient-card';
        card.innerHTML = `<strong>${patient.name}</strong>, Age: ${patient.age}, Gender: ${patient.gender}<br>
          <button class="view-patient-btn" data-index="${origIdx}">View</button>
          <button class="edit-patient-btn" data-index="${origIdx}">Edit</button>`;
        patientList.appendChild(card);
    });
}
patientSearchInput.addEventListener("input", function () {
    const q = patientSearchInput.value.trim();
    filteredPatients = q ? filterPatients(q) : null;
    updatePatientListUI();
});
searchBtn.onclick = function () {
    const q = patientSearchInput.value.trim();
    filteredPatients = q ? filterPatients(q) : null;
    updatePatientListUI();
};

addForm.onsubmit = function (e) {
    e.preventDefault();
    const name = document.getElementById('patientName').value.trim();
    const email = document.getElementById('patientEmail').value.trim();
    const phone = document.getElementById('patientPhone').value.trim();
    const age = document.getElementById('patientAge').value.trim();
    const gender = document.getElementById('patientGender').value.trim();
    const address = document.getElementById('patientAddress').value.trim();
    if (!name || !email || !phone || !age || !gender || !address) { alert('Please fill in all fields'); return; }
    if (editingIndex !== null) {
        patients[editingIndex] = { ...patients[editingIndex], name, email, phone, age, gender, address };
        editingIndex = null;
        submitBtn.textContent = 'Save Patient';
    } else {
        patients.push({ name, email, phone, age, gender, address, ecg: null, resultNotes: "" });
    }
    filteredPatients = null;
    patientSearchInput.value = "";
    updatePatientListUI();
    updateMedicalRecordsUI();
    addModal.style.display = 'none';
    addForm.reset();
};

patientList.addEventListener('click', e => {
    if (e.target.classList.contains('edit-patient-btn')) {
        const idx = e.target.getAttribute('data-index');
        const p = patients[idx];
        document.getElementById('patientName').value = p.name;
        document.getElementById('patientEmail').value = p.email;
        document.getElementById('patientPhone').value = p.phone;
        document.getElementById('patientAge').value = p.age;
        document.getElementById('patientGender').value = p.gender;
        document.getElementById('patientAddress').value = p.address;
        editingIndex = idx;
        submitBtn.textContent = 'Save Changes';
        addModal.style.display = 'flex';
    }
    if (e.target.classList.contains('view-patient-btn')) {
        const idx = e.target.getAttribute('data-index');
        const p = patients[idx];
        document.getElementById('detailName').textContent = p.name;
        document.getElementById('detailEmail').textContent = p.email;
        document.getElementById('detailPhone').textContent = p.phone;
        document.getElementById('detailAge').textContent = p.age;
        document.getElementById('detailGender').textContent = p.gender;
        document.getElementById('detailAddress').textContent = p.address;
        viewPatientModal.style.display = 'flex';
    }
});

function updateMedicalRecordsUI() {
    medicalRecordsList.innerHTML = '';
    if (patients.length === 0) { medicalRecordsList.innerHTML = '<p>No patient medical records yet.</p>'; return; }
    patients.forEach((patient, idx) => {
        const recDiv = document.createElement('div');
        recDiv.className = 'medical-record-card';
        recDiv.innerHTML = `<div><strong>${patient.name}</strong>, Age: ${patient.age}, Gender: ${patient.gender}, Phone: ${patient.phone}</div>
          <label>ECG Image:</label><br>
         <input type="file" accept="image/png" class="ecg-upload" data-index="${idx}">

          <div class="ecg-btns">
            <button class="delete-ecg-btn" data-index="${idx}">Delete ECG</button>
            <button class="view-ecg-result-btn" data-index="${idx}">View Result</button>
          </div>
          <div class="ecg-preview" style="margin-top:5px;">
            ${patient.ecg ? `<img src="${patient.ecg}" style="max-width:150px;">` : '<em>No ECG uploaded.</em>'}
          </div><hr />`;
        medicalRecordsList.appendChild(recDiv);
    });
}

medicalRecordsList.addEventListener('change', e => {
    if (e.target.classList.contains('ecg-upload')) {
        const idx = e.target.getAttribute('data-index');
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => { patients[idx].ecg = ev.target.result; updateMedicalRecordsUI(); };
            reader.readAsDataURL(file);
        }
    }
});

medicalRecordsList.addEventListener('click', e => {
    if (e.target.classList.contains('delete-ecg-btn')) {
        const idx = e.target.getAttribute('data-index');
        patients[idx].ecg = null;
        updateMedicalRecordsUI();
    }
    if (e.target.classList.contains('view-ecg-result-btn')) {
        const idx = e.target.getAttribute('data-index');
        ecgResultPatientIdx = idx;
        const patient = patients[idx];
        ecgResultName.textContent = patient.name;
        ecgResultPhone.textContent = patient.phone;
        ecgResultAge.textContent = patient.age;
        ecgResultHistory.innerHTML = patient.ecg ? `<img src="${patient.ecg}" style="max-width:380px;">` : '<em>No ECG uploaded.</em>';
        ecgResultDescription.value = patient.resultNotes || "";
        medicalRecordsSection.style.display = 'none';
        doctorSection.style.display = 'none';
        ecgResultSection.style.display = 'block';
    }
});

ecgResultSaveBtn.onclick = function () {
    if (ecgResultPatientIdx !== null) {
        patients[ecgResultPatientIdx].resultNotes = ecgResultDescription.value;
        ecgResultSaveBtn.textContent = "Saved!";
        setTimeout(() => { ecgResultSaveBtn.textContent = "Save"; }, 1000);
    }
};
ecgResultBackBtn.onclick = function () {
    ecgResultSection.style.display = "none";
    activateTab(navMedical);
    medicalRecordsSection.style.display = "";
};

window.onclick = e => {
    if (e.target === addModal) addModal.style.display = 'none';
    if (e.target === viewPatientModal) viewPatientModal.style.display = 'none';
};
medicalRecordsList.addEventListener('change', e => {
    if (e.target.classList.contains('ecg-upload')) {
        const file = e.target.files[0];
        if (file && file.type !== 'image/png') {
            alert('Only PNG files are allowed.');
            e.target.value = ''; // Reset the file input
            return;
        }
        // rest of your code to read the file
    }
});
const doctorsDataset = [
    { email: 'doctor1@example.com', password: 'pass123', fullName: 'Dr. John Doe' },
    { email: 'doctor2@example.com', password: 'password', fullName: 'Dr. Jane Smith' }
];
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Find matching doctor in dataset
    const doctor = doctorsDataset.find(d => d.email === email && d.password === password);

    if (doctor) {
        // Set session storage
        sessionStorage.setItem('isLoggedIn', 'true');
        sessionStorage.setItem('userEmail', doctor.email);
        sessionStorage.setItem('user', JSON.stringify(doctor));
        // Redirect to dashboard
        window.location.href = 'main.html';
    } else {
        // Show error message
        document.getElementById('errorMsg').style.display = 'block';
        document.getElementById('errorMsg').textContent = 'Invalid email or password';
    }
});
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  errorMsg.style.display = 'none';
  successMsg.style.display = 'none';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if (!email || !password) {
    showError('Please fill in all fields');
    return;
  }

  loginBtn.innerHTML = '<span class="spinner"></span>Logging in...';
  loginBtn.classList.add('loading');

  // Hardcoded doctors dataset for local fallback validation
  const doctorsDataset = [
    { email: 'doctor1@example.com', password: 'pass123', fullName: 'Dr. Alice' },
    { email: 'doctor2@example.com', password: 'password', fullName: 'Dr. Bob' }
  ];

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      if (data.token) {
        sessionStorage.setItem('authToken', data.token);
      }
      if (data.user) {
        sessionStorage.setItem('user', JSON.stringify(data.user));
      }
      sessionStorage.setItem('userEmail', email);
      sessionStorage.setItem('isLoggedIn', 'true');
      showSuccess('Login successful! Redirecting...');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    } else {
      showError(data.message || 'Invalid email or password');
    }
  } catch (error) {
    // Backend failed, use local fallback validation
    const localMatch = doctorsDataset.find(d => d.email === email && d.password === password);
    if (localMatch) {
      sessionStorage.setItem('userEmail', email);
      sessionStorage.setItem('user', JSON.stringify({ fullName: localMatch.fullName }));
      sessionStorage.setItem('isLoggedIn', 'true');
      showSuccess('Login successful (local fallback)! Redirecting...');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    } else {
      showError('Unable to connect to server and invalid credentials.');
    }
  } finally {
    loginBtn.innerHTML = 'Log In';
    loginBtn.classList.remove('loading');
  }
  function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    if (isLoggedIn !== 'true') {
        window.location.href = 'login.html'; // Redirect to login if not logged in
        return;
    }
    // rest of your code to display doctor name etc.
}

checkAuth(); // Call this as soon as your script runs

});


updatePatientListUI();
updateMedicalRecordsUI();