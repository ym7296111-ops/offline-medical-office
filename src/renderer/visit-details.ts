import {
  addPrescriptionItem,
  addVisitProcedure,
  createPrescription,
  deletePrescriptionItem,
  deleteVisitProcedure,
  dischargeVisit,
  getVisit,
  listActiveDrugs,
  listPrescriptionsByVisit,
  listProcedures,
  listVisitProcedures,
  type DrugRow,
  type PrescriptionWithItemsRow,
  type ProcedureRow,
  type VisitProcedureRow,
  type VisitWithPatientRow
} from './ipc-client';

const CATEGORY_LABELS: Record<string, string> = {
  radiology: 'أشعة',
  lab: 'تحاليل',
  ambulance: 'إسعاف'
};

const caseNumberEl = document.getElementById('caseNumber') as HTMLSpanElement;
const patientNameEl = document.getElementById('patientName') as HTMLSpanElement;
const patientFileEl = document.getElementById('patientFile') as HTMLSpanElement;
const admissionDateEl = document.getElementById('admissionDate') as HTMLSpanElement;
const visitStatusEl = document.getElementById('visitStatus') as HTMLSpanElement;
const loadMessageEl = document.getElementById('loadMessage') as HTMLParagraphElement;

const procedureSection = document.getElementById('procedureSection') as HTMLDivElement;
const form = document.getElementById('procedureForm') as HTMLFormElement;
const procedureSelect = document.getElementById('procedure_id') as HTMLSelectElement;
const quantityInput = document.getElementById('quantity') as HTMLInputElement;
const priceInput = document.getElementById('unit_price') as HTMLInputElement;
const dateInput = document.getElementById('procedure_date') as HTMLInputElement;
const notesInput = document.getElementById('notes') as HTMLInputElement;
const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
const messageEl = document.getElementById('message') as HTMLParagraphElement;
const tableBody = document.querySelector('#proceduresTable tbody') as HTMLTableSectionElement;
const emptyState = document.getElementById('emptyState') as HTMLParagraphElement;
const dischargeBar = document.getElementById('dischargeBar') as HTMLDivElement;
const btnDischarge = document.getElementById('btnDischarge') as HTMLButtonElement;
const reportLink = document.getElementById('reportLink') as HTMLAnchorElement;
const dischargeMessageEl = document.getElementById('dischargeMessage') as HTMLSpanElement;
const totalGrossEl = document.getElementById('totalGross') as HTMLSpanElement;
const patientShareEl = document.getElementById('patientShare') as HTMLSpanElement;
const insurerShareEl = document.getElementById('insurerShare') as HTMLSpanElement;

const prescriptionSection = document.getElementById('prescriptionSection') as HTMLDivElement;
const btnNewPrescription = document.getElementById('btnNewPrescription') as HTMLButtonElement;
const rxMessageEl = document.getElementById('rxMessage') as HTMLSpanElement;
const prescriptionListEl = document.getElementById('prescriptionList') as HTMLDivElement;
const rxEmptyState = document.getElementById('rxEmptyState') as HTMLParagraphElement;
const rxForm = document.getElementById('rxItemForm') as HTMLFormElement;
const rxPrescriptionSelect = document.getElementById('rxPrescription') as HTMLSelectElement;
const rxDrugSelect = document.getElementById('rxDrug') as HTMLSelectElement;
const rxQuantityInput = document.getElementById('rxQuantity') as HTMLInputElement;
const rxUnitPriceInput = document.getElementById('rxUnitPrice') as HTMLInputElement;
const rxNotesInput = document.getElementById('rxNotes') as HTMLInputElement;
const rxSubmitBtn = document.getElementById('rxSubmitBtn') as HTMLButtonElement;
const rxTotalHint = document.getElementById('rxTotalHint') as HTMLSpanElement;
const rxFormMessageEl = document.getElementById('rxFormMessage') as HTMLParagraphElement;

let visitId: number | null = null;
let visit: VisitWithPatientRow | null = null;
let procedures: ProcedureRow[] = [];
let drugs: DrugRow[] = [];
let prescriptions: PrescriptionWithItemsRow[] = [];

function setMessage(el: HTMLElement, text: string, kind: 'ok' | 'error' | 'idle'): void {
  el.textContent = text;
  el.style.color = kind === 'error' ? 'red' : kind === 'ok' ? 'green' : '#222';
}

function todayLocalIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatMoney(value: number): string {
  return `${value.toLocaleString('en-US')}`;
}

/** Reads ?id= from the page URL. */
function readVisitId(): number | null {
  const raw = new URLSearchParams(window.location.search).get('id');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function textCell(value: string): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = value;
  return td;
}

function renderProcedures(rows: VisitProcedureRow[]): void {
  const built = rows.map((row) => {
    const tr = document.createElement('tr');
    tr.appendChild(textCell(row.procedure_name_snapshot));
    tr.appendChild(textCell(CATEGORY_LABELS[row.procedure_category_snapshot] ?? row.procedure_category_snapshot));
    tr.appendChild(textCell(String(row.quantity)));
    tr.appendChild(textCell(formatMoney(row.unit_price_snapshot)));
    tr.appendChild(textCell(formatMoney(row.row_total)));
    tr.appendChild(textCell(row.procedure_date));
    tr.appendChild(textCell(row.notes ?? '—'));

    const tdAction = document.createElement('td');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'danger';
    btn.textContent = 'حذف';
    btn.addEventListener('click', () => void handleDelete(row.id));
    tdAction.appendChild(btn);
    tr.appendChild(tdAction);

    return tr;
  });

  tableBody.replaceChildren(...built);
  // The "no procedures yet" note is shown only when there are no rows.
  const isEmpty = built.length === 0;
  emptyState.classList.toggle('hidden', !isEmpty);
}

function renderTotals(current: VisitWithPatientRow): void {
  totalGrossEl.textContent = formatMoney(current.total_gross_amount);
  patientShareEl.textContent = formatMoney(current.patient_share_amount);
  insurerShareEl.textContent = formatMoney(current.insurer_share_amount);
}

function renderVisitHeader(current: VisitWithPatientRow): void {
  caseNumberEl.textContent = current.case_number;
  patientNameEl.textContent = current.patient_name;
  patientFileEl.textContent = current.patient_file_number;
  admissionDateEl.textContent = current.admission_date;
  visitStatusEl.replaceChildren();
  const badge = document.createElement('span');
  const isOpen = current.discharge_date === null;
  badge.className = isOpen ? 'badge open' : 'badge closed';
  badge.textContent = isOpen ? 'نشطة' : 'مغلقة';
  visitStatusEl.appendChild(badge);
}

function fillProcedureSelect(items: ProcedureRow[]): void {
  const placeholder = procedureSelect.firstElementChild;
  const rebuilt: HTMLElement[] = [];
  if (placeholder) rebuilt.push(placeholder as HTMLElement);
  for (const item of items) {
    const option = document.createElement('option');
    option.value = String(item.id);
    option.textContent = `${item.name} (${CATEGORY_LABELS[item.category] ?? item.category}) — ${item.current_price}`;
    rebuilt.push(option);
  }
  procedureSelect.replaceChildren(...rebuilt);
}

/** Shows the discharge action for an open visit, or the report link once discharged (WF-009/WF-010). */
function renderDischargeBar(current: VisitWithPatientRow): void {
  const isOpen = current.discharge_date === null;
  dischargeBar.classList.remove('hidden');
  btnDischarge.classList.toggle('hidden', !isOpen);
  reportLink.classList.toggle('hidden', isOpen);

  if (!isOpen) {
    reportLink.setAttribute('href', `discharge.html?id=${current.id}`);
    setMessage(dischargeMessageEl, `تم الخروج بتاريخ ${current.discharge_date}`, 'ok');
  } else {
    reportLink.removeAttribute('href');
    setMessage(dischargeMessageEl, '', 'idle');
  }
}

btnDischarge.addEventListener('click', async () => {
  if (visitId === null) return;

  const answer = window.prompt('تاريخ الخروج (YYYY-MM-DD):', todayLocalIso());
  if (answer === null) return; // user cancelled

  const dischargeDate = answer.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dischargeDate)) {
    setMessage(dischargeMessageEl, 'تاريخ الخروج غير صالح — الصيغة المطلوبة YYYY-MM-DD.', 'error');
    return;
  }

  btnDischarge.disabled = true;
  setMessage(dischargeMessageEl, 'جاري تسجيل الخروج...', 'idle');

  try {
    await dischargeVisit(visitId, dischargeDate);
    setMessage(dischargeMessageEl, 'تم تسجيل الخروج بنجاح — جاري فتح التقرير...', 'ok');
    window.location.href = `discharge.html?id=${visitId}`;
  } catch (error: any) {
    setMessage(dischargeMessageEl, error.message, 'error');
  } finally {
    btnDischarge.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// العلاج (الروشتة) — WF-007 / WF-008
// ---------------------------------------------------------------------------

function setRxMessage(el: HTMLElement, text: string, kind: 'ok' | 'error' | 'idle'): void {
  setMessage(el, text, kind);
}

/** Rebuilds a <select> keeping its first placeholder option. */
function rebuildSelect(
  select: HTMLSelectElement,
  items: { value: string; label: string }[]
): void {
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

function renderPrescriptionSelect(): void {
  const previous = rxPrescriptionSelect.value;
  rebuildSelect(
    rxPrescriptionSelect,
    prescriptions.map((rx) => ({
      value: String(rx.id),
      label: `روشتة ${rx.prescription_date} — ${formatMoney(rx.total_amount)} (${rx.items.length} دواء)`
    }))
  );
  // Keep the user's choice across a refresh when it still exists.
  if (prescriptions.some((rx) => String(rx.id) === previous)) {
    rxPrescriptionSelect.value = previous;
  }
  updateRxTotalHint();
}

/** Shows the running total of the prescription currently selected in the form. */
function updateRxTotalHint(): void {
  const selected = prescriptions.find((rx) => String(rx.id) === rxPrescriptionSelect.value);
  rxTotalHint.textContent = formatMoney(selected ? selected.total_amount : 0);
}

/** One read-only table per prescription, with a delete button per drug. */
function renderPrescriptions(rows: PrescriptionWithItemsRow[]): void {
  const cards = rows.map((rx) => {
    const card = document.createElement('div');
    card.className = 'rx';

    const head = document.createElement('div');
    head.className = 'rx-head';
    const title = document.createElement('h3');
    title.textContent = `روشتة ${rx.prescription_date}`;
    head.appendChild(title);

    if (rx.notes) {
      const meta = document.createElement('span');
      meta.className = 'rx-meta';
      meta.textContent = rx.notes;
      head.appendChild(meta);
    }

    const total = document.createElement('span');
    total.className = 'rx-total';
    total.textContent = `الإجمالي: ${formatMoney(rx.total_amount)}`;
    head.appendChild(total);
    card.appendChild(head);

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const label of ['الدواء', 'الكمية', 'سعر الوحدة', 'الإجمالي', 'الجرعة / التعليمات', 'إجراء']) {
      const th = document.createElement('th');
      th.textContent = label;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const item of rx.items) {
      const tr = document.createElement('tr');
      tr.appendChild(textCell(item.drug_name_snapshot));
      tr.appendChild(textCell(String(item.quantity)));
      tr.appendChild(textCell(formatMoney(item.unit_price_snapshot)));
      tr.appendChild(textCell(formatMoney(item.row_total)));
      tr.appendChild(textCell(item.notes ?? '—'));

      const tdAction = document.createElement('td');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'danger';
      btn.textContent = 'حذف';
      btn.addEventListener('click', () => void handleDeleteRxItem(item.id));
      tdAction.appendChild(btn);
      tr.appendChild(tdAction);

      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    card.appendChild(table);

    return card;
  });

  prescriptionListEl.replaceChildren(...cards);
  const isEmpty = cards.length === 0;
  rxEmptyState.classList.toggle('hidden', !isEmpty);
}

function renderDrugSelect(items: DrugRow[]): void {
  rebuildSelect(
    rxDrugSelect,
    items.map((drug) => ({
      value: String(drug.id),
      label: `${drug.name} — ${formatMoney(drug.current_price)}`
    }))
  );
}

/** Selecting a drug pre-fills its current catalog price and the prescription's running total. */
rxDrugSelect.addEventListener('change', () => {
  const selected = drugs.find((d) => String(d.id) === rxDrugSelect.value);
  if (selected) rxUnitPriceInput.value = String(selected.current_price);
});

rxPrescriptionSelect.addEventListener('change', updateRxTotalHint);

btnNewPrescription.addEventListener('click', async () => {
  if (visitId === null) return;

  btnNewPrescription.disabled = true;
  setRxMessage(rxMessageEl, 'جاري إنشاء الروشتة...', 'idle');

  try {
    // WF-007 step 2: prescription_date defaults to today.
    await createPrescription({
      visit_id: visitId,
      prescription_date: todayLocalIso(),
      notes: null
    });
    setRxMessage(rxMessageEl, 'تم إنشاء روشتة جديدة.', 'ok');
    await refreshPrescriptions(true);
  } catch (error: any) {
    setRxMessage(rxMessageEl, error.message, 'error');
  } finally {
    btnNewPrescription.disabled = false;
  }
});

async function handleDeleteRxItem(itemId: number): Promise<void> {
  setMessage(rxFormMessageEl, 'جاري الحذف...', 'idle');
  try {
    const result = await deletePrescriptionItem(itemId);
    setMessage(
      rxFormMessageEl,
      result.deleted_prescription ? 'تم حذف آخر دواء، وحُذفت الروشتة الفارغة.' : 'تم حذف الدواء.',
      'ok'
    );
    await refresh();
  } catch (error: any) {
    setMessage(rxFormMessageEl, error.message, 'error');
  }
}

rxForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (visitId === null) {
    setMessage(rxFormMessageEl, 'رقم الإقامة غير صالح.', 'error');
    return;
  }

  const prescriptionId = rxPrescriptionSelect.value ? Number(rxPrescriptionSelect.value) : null;
  if (!prescriptionId) {
    setMessage(rxFormMessageEl, 'يجب اختيار الروشتة أولًا.', 'error');
    return;
  }

  const drugId = rxDrugSelect.value ? Number(rxDrugSelect.value) : null;
  if (!drugId) {
    setMessage(rxFormMessageEl, 'يجب اختيار الدواء.', 'error');
    return;
  }

  const quantity = Number(rxQuantityInput.value || 1);
  if (!Number.isInteger(quantity) || quantity < 1) {
    setMessage(rxFormMessageEl, 'الكمية يجب أن تكون 1 على الأقل.', 'error');
    return;
  }

  setMessage(rxFormMessageEl, 'جاري الحفظ...', 'idle');
  rxSubmitBtn.disabled = true;

  try {
    await addPrescriptionItem({
      prescription_id: prescriptionId,
      drug_id: drugId,
      quantity,
      unit_price: Number(rxUnitPriceInput.value),
      notes: rxNotesInput.value || null
    });
    setMessage(rxFormMessageEl, 'تمت إضافة الدواء للروشتة!', 'ok');
    rxQuantityInput.value = '1';
    rxNotesInput.value = '';
    // A price override rewrites the catalog, so re-read the drug list too.
    await refresh();
  } catch (error: any) {
    setMessage(rxFormMessageEl, error.message, 'error');
  } finally {
    rxSubmitBtn.disabled = false;
  }
});

/** Reloads the drug catalog and the visit's prescriptions. */
async function refreshPrescriptions(selectNewest = false): Promise<void> {
  if (visitId === null) return;
  try {
    drugs = await listActiveDrugs();
    renderDrugSelect(drugs);

    prescriptions = await listPrescriptionsByVisit(visitId);
    renderPrescriptions(prescriptions);
    renderPrescriptionSelect();

    // After creating a prescription, jump the form to the newest one for convenience.
    if (selectNewest && prescriptions.length > 0) {
      const newest = prescriptions[prescriptions.length - 1];
      rxPrescriptionSelect.value = String(newest.id);
      updateRxTotalHint();
    }
  } catch (error: any) {
    setMessage(rxFormMessageEl, error.message, 'error');
  }
}

/** Loads the visit, its line items, and the catalog. */
async function refresh(): Promise<void> {
  if (visitId === null) return;
  try {
    visit = await getVisit(visitId);
    renderVisitHeader(visit);

    const rows = await listVisitProcedures(visitId);
    renderProcedures(rows);
    renderTotals(visit);

    const isOpen = visit.discharge_date === null;
    procedureSection.classList.toggle('hidden', !isOpen);
    // WF-007/WF-008: a closed visit accepts no new drugs and no deletions.
    prescriptionSection.classList.toggle('hidden', !isOpen);
    renderDischargeBar(visit);

    await refreshPrescriptions();
    // Prescriptions change the gross, which renderTotals above already read — re-read it.
    if (visitId !== null) {
      visit = await getVisit(visitId);
      renderTotals(visit);
    }

    if (!isOpen) {
      setMessage(loadMessageEl, 'هذه الإقامة مغلقة — لا يمكن إضافة إجراءات أو أدوية جديدة.', 'error');
    }
  } catch (error: any) {
    setMessage(loadMessageEl, error.message, 'error');
    procedureSection.classList.add('hidden');
    prescriptionSection.classList.add('hidden');
  }
}

async function handleDelete(id: number): Promise<void> {
  setMessage(messageEl, 'جاري الحذف...', 'idle');
  try {
    await deleteVisitProcedure(id);
    setMessage(messageEl, 'تم حذف البند.', 'ok');
    await refresh();
  } catch (error: any) {
    setMessage(messageEl, error.message, 'error');
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (visitId === null) {
    setMessage(messageEl, 'رقم الإقامة غير صالح.', 'error');
    return;
  }

  const procedureId = procedureSelect.value ? Number(procedureSelect.value) : null;
  if (!procedureId) {
    setMessage(messageEl, 'يجب اختيار الإجراء.', 'error');
    return;
  }

  setMessage(messageEl, 'جاري الحفظ...', 'idle');
  submitBtn.disabled = true;

  try {
    await addVisitProcedure({
      visit_id: visitId,
      procedure_id: procedureId,
      quantity: Number(quantityInput.value || 1),
      unit_price: Number(priceInput.value),
      procedure_date: dateInput.value,
      notes: notesInput.value || null
    });
    setMessage(messageEl, 'تمت إضافة الإجراء بنجاح!', 'ok');
    quantityInput.value = '1';
    notesInput.value = '';
    await refresh();
  } catch (error: any) {
    setMessage(messageEl, error.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

/** Selecting a procedure pre-fills the price with its current catalog price (WF-003 step 3). */
procedureSelect.addEventListener('change', () => {
  const selected = procedures.find((p) => String(p.id) === procedureSelect.value);
  if (selected) priceInput.value = String(selected.current_price);
});

async function init(): Promise<void> {
  visitId = readVisitId();
  if (visitId === null) {
    setMessage(loadMessageEl, 'لم يتم تحديد إقامة صالحة. يجب فتح الصفحة بالشكل: visit-details.html?id=<رقم>', 'error');
    procedureSection.classList.add('hidden');
    prescriptionSection.classList.add('hidden');
    return;
  }

  dateInput.value = todayLocalIso();
  dateInput.max = todayLocalIso();

  try {
    procedures = await listProcedures();
    fillProcedureSelect(procedures);
  } catch (error: any) {
    setMessage(messageEl, error.message, 'error');
  }

  await refresh();
}

void init();
