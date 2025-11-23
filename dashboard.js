
let patients = [];
let editingIndex = null;
let filteredPatients = null;

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
const mainSections = [welcomeSection, doctorSection, medicalRecordsSection];
const patientSearchInput = document.getElementById('patient-search');
const searchBtn = document.getElementById('search-btn');

// NAVIGATION
function activateTab(tab) {
  navWelcome.classList.remove('active');
  navDoctor.classList.remove('active');
  navMedical.classList.remove('active');
  welcomeSection.style.display = 'none';
  doctorSection.style.display = 'none';
  medicalRecordsSection.style.display = 'none';
  tab.classList.add('active');
}
navWelcome.onclick = (e) => {
  e.preventDefault();
  activateTab(navWelcome);
  welcomeSection.style.display = '';
};
navDoctor.onclick = (e) => {
  e.preventDefault();
  activateTab(navDoctor);
  doctorSection.style.display = '';
};
navMedical.onclick = (e) => {
  e.preventDefault();
  activateTab(navMedical);
  medicalRecordsSection.style.display = '';
};
activateTab(navWelcome); // Default to welcome
welcomeSection.style.display = '';

// LOGOUT LOGIC
logoutBtn.onclick = () => {
  document.querySelector("nav").style.display = "none";
  mainSections.forEach(section => section.style.display = "none");
  addModal.style.display = 'none';
  viewPatientModal.style.display = 'none';
  sessionTerminatedSection.style.display = 'block';
};

// MODALS
addBtn.onclick = () => {
  editingIndex = null;
  addForm.reset();
  submitBtn.textContent = 'Save Patient';
  addModal.style.display = 'flex';
};
closeAddModal.onclick = () => { addModal.style.display = 'none'; };
closeViewModal.onclick = () => { viewPatientModal.style.display = 'none'; };

// SEARCH & FILTER PATIENTS
function filterPatients(query) {
  const q = query.toLowerCase();
  return patients.filter(p =>
    p.name?.toLowerCase().includes(q) ||
    p.email?.toLowerCase().includes(q) ||
    p.phone?.toLowerCase().includes(q) ||
    p.address?.toLowerCase().includes(q) ||
    p.gender?.toLowerCase().includes(q) ||
    p.age?.toString().includes(q)
  );
}
function updatePatientListUI() {
  let listToDisplay = filteredPatients !== null ? filteredPatients : patients;
  patientList.innerHTML = '';
  if (listToDisplay.length === 0) {
    patientList.innerHTML = '<p>No patients found.</p>';
    return;
  }
  listToDisplay.forEach((patient, idx) => {
    const origIdx = patients.indexOf(patient);
    const card = document.createElement('div');
    card.className = 'patient-card';
    card.innerHTML = `
      <strong>${patient.name}</strong>, Age: ${patient.age}, Gender: ${patient.gender}<br>
      <button class="view-patient-btn" data-index="${origIdx}">View</button>
      <button class="edit-patient-btn" data-index="${origIdx}">Edit</button>
    `;
    patientList.appendChild(card);
  });
}
patientSearchInput.addEventListener("input", function () {
  const query = patientSearchInput.value.trim();
  filteredPatients = query ? filterPatients(query) : null;
  updatePatientListUI();
});
searchBtn.onclick = function () {
  const query = patientSearchInput.value.trim();
  filteredPatients = query ? filterPatients(query) : null;
  updatePatientListUI();
};

// PATIENTS ADD/EDIT
addForm.onsubmit = function (e) {
  e.preventDefault();
  const name = document.getElementById('patientName').value.trim();
  const email = document.getElementById('patientEmail').value.trim();
  const phone = document.getElementById('patientPhone').value.trim();
  const age = document.getElementById('patientAge').value.trim();
  const gender = document.getElementById('patientGender').value.trim();
  const address = document.getElementById('patientAddress').value.trim();

  if (!name || !email || !phone || !age || !gender || !address) {
    alert('Please fill in all fields');
    return;
  }

  if (editingIndex !== null) {
    patients[editingIndex] = { ...patients[editingIndex], name, email, phone, age, gender, address };
    editingIndex = null;
    submitBtn.textContent = 'Save Patient';
  } else {
    patients.push({ name, email, phone, age, gender, address, ecg: null });
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

// MEDICAL RECORDS
function updateMedicalRecordsUI() {
  medicalRecordsList.innerHTML = '';
  if (patients.length === 0) {
    medicalRecordsList.innerHTML = '<p>No patient medical records yet.</p>';
    return;
  }
  patients.forEach((patient, idx) => {
    const recDiv = document.createElement('div');
    recDiv.className = 'medical-record-card';
    recDiv.innerHTML = `
      <div><strong>${patient.name}</strong>, Age: ${patient.age}, Gender: ${patient.gender}</div>
      <label>ECG Image:</label><br>
      <input type="file" accept="image/*" class="ecg-upload" data-index="${idx}">
      <button class="delete-ecg-btn" data-index="${idx}">Delete ECG</button>
      <div class="ecg-preview" style="margin-top:5px;">
        ${patient.ecg ? `<img src="${patient.ecg}" style="max-width:150px; vertical-align:middle;">` : '<em>No ECG uploaded.</em>'}
      </div>
      <hr />
    `;
    medicalRecordsList.appendChild(recDiv);
  });
}

medicalRecordsList.addEventListener('change', e => {
  if (e.target.classList.contains('ecg-upload')) {
    const idx = e.target.getAttribute('data-index');
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => {
        patients[idx].ecg = ev.target.result;
        updateMedicalRecordsUI();
      };
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
});

window.onclick = e => {
  if (e.target === addModal) addModal.style.display = 'none';
  if (e.target === viewPatientModal) viewPatientModal.style.display = 'none';
};

// INIT
updatePatientListUI();
updateMedicalRecordsUI();
