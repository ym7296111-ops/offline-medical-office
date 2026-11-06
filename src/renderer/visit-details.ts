import {
  addVisitProcedure,
  deleteVisitProcedure,
  getVisit,
  listProcedures,
  listVisitProcedures,
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
const totalGrossEl = document.getElementById('totalGross') as HTMLSpanElement;
const patientShareEl = document.getElementById('patientShare') as HTMLSpanElement;
const insurerShareEl = document.getElementById('insurerShare') as HTMLSpanElement;

let visitId: number | null = null;
let visit: VisitWithPatientRow | null = null;
let procedures: ProcedureRow[] = [];

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
    if (!isOpen) {
      setMessage(loadMessageEl, 'هذه الإقامة مغلقة — لا يمكن إضافة إجراءات جديدة.', 'error');
    }
  } catch (error: any) {
    setMessage(loadMessageEl, error.message, 'error');
    procedureSection.classList.add('hidden');
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
