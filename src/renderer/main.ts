import { createPatient, listPatients } from './ipc-client';

const form = document.getElementById('patientForm') as HTMLFormElement;
const fileNumberInput = document.getElementById('file_number') as HTMLInputElement;
const fullNameInput = document.getElementById('full_name') as HTMLInputElement;
const messageEl = document.getElementById('message') as HTMLParagraphElement;
const tableBody = document.querySelector('#patientsTable tbody') as HTMLTableSectionElement;

async function loadPatients() {
  try {
    const patients = await listPatients();
    tableBody.innerHTML = '';
    patients.forEach((p: any) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.file_number}</td><td>${p.full_name}</td>`;
      tableBody.appendChild(tr);
    });
  } catch (error: any) {
    messageEl.textContent = error.message;
    messageEl.style.color = 'red';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  messageEl.textContent = 'جاري الحفظ...';
  messageEl.style.color = 'black';
  try {
    await createPatient({
      file_number: fileNumberInput.value,
      full_name: fullNameInput.value,
    });
    fileNumberInput.value = '';
    fullNameInput.value = '';
    messageEl.textContent = 'تم الحفظ بنجاح!';
    messageEl.style.color = 'green';
    await loadPatients();
  } catch (error: any) {
    messageEl.textContent = error.message;
    messageEl.style.color = 'red';
  }
});

// Initial load
loadPatients();
