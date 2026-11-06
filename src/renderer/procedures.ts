import {
  createProcedure,
  listAllProcedures,
  toggleProcedure,
  type ProcedureRow
} from './ipc-client';

const CATEGORY_LABELS: Record<string, string> = {
  radiology: 'أشعة',
  lab: 'تحاليل',
  ambulance: 'إسعاف'
};

const form = document.getElementById('procedureForm') as HTMLFormElement;
const nameInput = document.getElementById('name') as HTMLInputElement;
const categorySelect = document.getElementById('category') as HTMLSelectElement;
const priceInput = document.getElementById('current_price') as HTMLInputElement;
const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
const messageEl = document.getElementById('message') as HTMLParagraphElement;
const tableBody = document.querySelector('#proceduresTable tbody') as HTMLTableSectionElement;
const emptyState = document.getElementById('emptyState') as HTMLParagraphElement;

function setMessage(text: string, kind: 'ok' | 'error' | 'idle'): void {
  messageEl.textContent = text;
  messageEl.style.color = kind === 'error' ? 'red' : kind === 'ok' ? 'green' : '#222';
}

function textCell(value: string): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = value;
  return td;
}

async function handleToggle(id: number): Promise<void> {
  try {
    await toggleProcedure(id);
    await loadProcedures();
  } catch (error: any) {
    setMessage(error.message, 'error');
  }
}

function renderRows(rows: ProcedureRow[]): void {
  const built = rows.map((row) => {
    const tr = document.createElement('tr');
    if (row.is_active === 0) tr.classList.add('inactive');

    tr.appendChild(textCell(row.name));
    tr.appendChild(textCell(CATEGORY_LABELS[row.category] ?? row.category));
    tr.appendChild(textCell(String(row.current_price)));

    const tdStatus = document.createElement('td');
    const status = document.createElement('span');
    status.className = row.is_active === 1 ? 'status active' : 'status inactive';
    status.textContent = row.is_active === 1 ? 'مفعّل' : 'غير مفعّل';
    tdStatus.appendChild(status);
    tr.appendChild(tdStatus);

    const tdAction = document.createElement('td');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toggle';
    btn.textContent = row.is_active === 1 ? 'تعطيل' : 'تفعيل';
    btn.addEventListener('click', () => void handleToggle(row.id));
    tdAction.appendChild(btn);
    tr.appendChild(tdAction);

    return tr;
  });

  tableBody.replaceChildren(...built);
  // The "no procedures yet" note is shown only when there are no rows.
  const isEmpty = built.length === 0;
  emptyState.classList.toggle('hidden', !isEmpty);
}

async function loadProcedures(): Promise<void> {
  try {
    const rows = await listAllProcedures();
    renderRows(rows);
  } catch (error: any) {
    setMessage(error.message, 'error');
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  setMessage('جاري الحفظ...', 'idle');
  submitBtn.disabled = true;

  try {
    await createProcedure({
      name: nameInput.value,
      category: categorySelect.value as 'radiology' | 'lab' | 'ambulance',
      current_price: Number(priceInput.value || 0)
    });
    nameInput.value = '';
    priceInput.value = '0';
    setMessage('تمت إضافة الإجراء بنجاح!', 'ok');
    await loadProcedures();
  } catch (error: any) {
    setMessage(error.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

// Initial load
void loadProcedures();
