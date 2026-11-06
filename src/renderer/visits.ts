import {
  createPatient,
  createVisit,
  listInsuranceCompanies,
  listMedicalEntities,
  listPatients,
  type InsuranceCompanyRow,
  type MedicalEntityRow,
  type PatientRow
} from './ipc-client';

const form = document.getElementById('visitForm') as HTMLFormElement;
const patientSelect = document.getElementById('patient_id') as HTMLSelectElement;
const insuranceField = document.getElementById('insuranceField') as HTMLDivElement;
const insuranceSelect = document.getElementById('insurance_company_id') as HTMLSelectElement;
const copayInput = document.getElementById('patient_copay_percentage') as HTMLInputElement;
const copayHint = document.getElementById('copayHint') as HTMLSpanElement;
const statusSelect = document.getElementById('admission_status') as HTMLSelectElement;
const dateInput = document.getElementById('admission_date') as HTMLInputElement;
const entitySelect = document.getElementById('referred_entity_id') as HTMLSelectElement;
const notesInput = document.getElementById('notes') as HTMLInputElement;
const messageEl = document.getElementById('message') as HTMLParagraphElement;
const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
const successBox = document.getElementById('successBox') as HTMLDivElement;
const caseNumberEl = document.getElementById('caseNumber') as HTMLSpanElement;
const visitIdValueEl = document.getElementById('visitIdValue') as HTMLSpanElement;
const manageProceduresLink = document.getElementById('manageProceduresLink') as HTMLAnchorElement;

// Quick-add patient controls
const btnQuickAddPatient = document.getElementById('btnQuickAddPatient') as HTMLButtonElement;
const quickAddPatientForm = document.getElementById('quickAddPatientForm') as HTMLDivElement;
const btnSaveQuickPatient = document.getElementById('btnSaveQuickPatient') as HTMLButtonElement;
const btnCancelQuickPatient = document.getElementById('btnCancelQuickPatient') as HTMLButtonElement;
const newPatientFileInput = document.getElementById('new_patient_file') as HTMLInputElement;
const newPatientNameInput = document.getElementById('new_patient_name') as HTMLInputElement;
const newPatientPhoneInput = document.getElementById('new_patient_phone') as HTMLInputElement;
const quickPatientMessage = document.getElementById('quickPatientMessage') as HTMLParagraphElement;

function setMessage(text: string, kind: 'ok' | 'error' | 'idle'): void {
  messageEl.textContent = text;
  messageEl.style.color = kind === 'error' ? 'red' : kind === 'ok' ? 'green' : '#222';
}

/** Today's date as YYYY-MM-DD in local time (not UTC, to avoid an off-by-one day). */
function todayLocalIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addOption(select: HTMLSelectElement, value: string, label: string): void {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

/** Rebuilds a select's options while keeping its placeholder (first child). */
function fillSelect(select: HTMLSelectElement, items: Array<{ value: string; label: string }>): void {
  const placeholder = select.firstElementChild;
  const rebuilt: HTMLElement[] = [];
  if (placeholder) rebuilt.push(placeholder as HTMLElement);
  for (const item of items) {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    rebuilt.push(option);
  }
  select.replaceChildren(...rebuilt);
}

function currentContractType(): 'private' | 'insurance' {
  const checked = form.querySelector<HTMLInputElement>('input[name="contract_type"]:checked');
  return checked && checked.value === 'insurance' ? 'insurance' : 'private';
}

function applyContractType(): void {
  const isInsurance = currentContractType() === 'insurance';
  insuranceField.classList.toggle('hidden', !isInsurance);
  insuranceSelect.required = isInsurance;

  if (isInsurance) {
    // D-001: comprehensive insurance defaults to 0% patient share.
    copayInput.disabled = false;
    copayInput.value = '0';
    copayHint.textContent = 'عقد تأمين: النسبة قابلة للتعديل (0 = تأمين شامل).';
  } else {
    // D-002: private contract always 100%.
    copayInput.value = '100';
    copayInput.disabled = true;
    copayHint.textContent = 'العقد الخاص: يتحمل المريض 100% دائمًا.';
  }
}

async function loadPatients(): Promise<void> {
  try {
    const patients = await listPatients();
    fillSelect(
      patientSelect,
      patients.map((p: PatientRow) => ({
        value: String(p.id),
        label: `${p.file_number} — ${p.full_name}`
      }))
    );
  } catch (error: any) {
    setMessage(error.message, 'error');
  }
}

async function loadInsuranceCompanies(): Promise<void> {
  try {
    const companies = await listInsuranceCompanies();
    fillSelect(
      insuranceSelect,
      companies
        .filter((c: InsuranceCompanyRow) => c.is_active === 1)
        .map((c: InsuranceCompanyRow) => ({ value: String(c.id), label: c.name }))
    );
    if (insuranceSelect.options.length <= 1) {
      addOption(insuranceSelect, '', 'لا توجد شركات تأمين مفعّلة');
      (insuranceSelect.lastElementChild as HTMLOptionElement).value = '';
    }
  } catch (error: any) {
    setMessage(error.message, 'error');
  }
}

async function loadEntities(): Promise<void> {
  try {
    const entities = await listMedicalEntities();
    fillSelect(
      entitySelect,
      entities
        .filter((e: MedicalEntityRow) => e.is_active === 1)
        .map((e: MedicalEntityRow) => ({ value: String(e.id), label: e.name }))
    );
  } catch (error: any) {
    setMessage(error.message, 'error');
  }
}

/** Shape returned by the patients:create IPC handler (better-sqlite3 RunResult). */
interface CreatePatientResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

function setQuickPatientMessage(text: string, kind: 'ok' | 'error' | 'idle'): void {
  quickPatientMessage.textContent = text;
  quickPatientMessage.style.color = kind === 'error' ? 'red' : kind === 'ok' ? 'green' : '#222';
}

function clearQuickAddForm(): void {
  newPatientFileInput.value = '';
  newPatientNameInput.value = '';
  newPatientPhoneInput.value = '';
  setQuickPatientMessage('', 'idle');
}

function showQuickAddForm(show: boolean): void {
  quickAddPatientForm.style.display = show ? 'flex' : 'none';
  if (show) {
    newPatientFileInput.focus();
  } else {
    clearQuickAddForm();
  }
}

async function saveQuickPatient(): Promise<void> {
  const fileNumber = newPatientFileInput.value.trim();
  const fullName = newPatientNameInput.value.trim();
  const phone = newPatientPhoneInput.value.trim();

  if (!fileNumber) {
    setQuickPatientMessage('رقم الملف مطلوب', 'error');
    newPatientFileInput.focus();
    return;
  }
  if (!fullName) {
    setQuickPatientMessage('الاسم مطلوب', 'error');
    newPatientNameInput.focus();
    return;
  }

  btnSaveQuickPatient.disabled = true;
  setQuickPatientMessage('جاري الحفظ...', 'idle');

  try {
    const result = (await createPatient({
      file_number: fileNumber,
      full_name: fullName,
      emergency_contact_phone: phone || null
    })) as CreatePatientResult;

    const newPatientId = Number(result.lastInsertRowid);

    showQuickAddForm(false);
    await loadPatients();
    patientSelect.value = String(newPatientId);

    // The quick-add panel is hidden by now, so report success in the main message area.
    setMessage(`تمت إضافة المريض «${fullName}» واختياره.`, 'ok');
  } catch (error: any) {
    setQuickPatientMessage(error.message, 'error');
  } finally {
    btnSaveQuickPatient.disabled = false;
  }
}

form.addEventListener('change', (event) => {
  const target = event.target as HTMLElement;
  if (target instanceof HTMLInputElement && target.name === 'contract_type') {
    applyContractType();
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  successBox.classList.add('hidden');
  setMessage('جاري الحفظ...', 'idle');
  submitBtn.disabled = true;

  const patientId = patientSelect.value ? Number(patientSelect.value) : null;
  if (!patientId) {
    setMessage('يجب اختيار المريض', 'error');
    submitBtn.disabled = false;
    return;
  }

  const contractType = currentContractType();
  const insuranceId = contractType === 'insurance' ? Number(insuranceSelect.value) : null;
  if (contractType === 'insurance' && !insuranceId) {
    setMessage('يجب اختيار شركة التأمين عند اختيار عقد تأمين', 'error');
    submitBtn.disabled = false;
    return;
  }

  try {
    const visit = await createVisit({
      patient_id: patientId,
      admission_status: statusSelect.value as
        | 'stable'
        | 'critical'
        | 'emergency'
        | 'under_observation',
      contract_type: contractType,
      insurance_company_id: insuranceId,
      patient_copay_percentage: Number(copayInput.value || 0),
      referred_entity_id: entitySelect.value ? Number(entitySelect.value) : null,
      admission_date: dateInput.value,
      notes: notesInput.value || null
    });

    setMessage('تم فتح الإقامة بنجاح!', 'ok');
    caseNumberEl.textContent = visit.case_number;
    visitIdValueEl.textContent = String(visit.id);
    manageProceduresLink.href = `visit-details.html?id=${visit.id}`;
    successBox.classList.remove('hidden');
    notesInput.value = '';
  } catch (error: any) {
    setMessage(error.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

btnQuickAddPatient.addEventListener('click', () => {
  const isHidden = quickAddPatientForm.style.display === 'none';
  showQuickAddForm(isHidden);
  if (isHidden) setMessage('', 'idle');
});

btnCancelQuickPatient.addEventListener('click', () => {
  showQuickAddForm(false);
});

btnSaveQuickPatient.addEventListener('click', () => {
  void saveQuickPatient();
});

// The quick-add inputs live inside the visit form, so Enter would submit the visit.
// Intercept it there and save the patient instead.
[newPatientFileInput, newPatientNameInput, newPatientPhoneInput].forEach((input) => {
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void saveQuickPatient();
    }
  });
});

// Initial state and data load
dateInput.value = todayLocalIso();
dateInput.max = todayLocalIso();
applyContractType();
loadPatients();
loadInsuranceCompanies();
loadEntities();
