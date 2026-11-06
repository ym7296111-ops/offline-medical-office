import { listActiveVisits, type ActiveVisitRow } from './ipc-client';

const STATUS_LABELS: Record<string, string> = {
  stable: 'مستقرة',
  critical: 'حرجة',
  emergency: 'طوارئ',
  under_observation: 'تحت الملاحظة'
};

const DEBOUNCE_MS = 300;

const searchInput = document.getElementById('searchInput') as HTMLInputElement;
const countLabel = document.getElementById('countLabel') as HTMLSpanElement;
const messageEl = document.getElementById('message') as HTMLParagraphElement;
const tableBody = document.querySelector('#visitsTable tbody') as HTMLTableSectionElement;
const emptyState = document.getElementById('emptyState') as HTMLParagraphElement;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
// Guards against out-of-order responses: a slow earlier search must never overwrite a
// newer one, which is easy to trigger by typing fast.
let requestSeq = 0;

function setMessage(text: string, kind: 'ok' | 'error' | 'idle'): void {
  messageEl.textContent = text;
  messageEl.style.color = kind === 'error' ? 'red' : kind === 'ok' ? 'green' : '#222';
}

function textCell(value: string): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = value;
  return td;
}

function renderRows(rows: ActiveVisitRow[]): void {
  const built = rows.map((row) => {
    const tr = document.createElement('tr');

    tr.appendChild(textCell(row.case_number));
    tr.appendChild(textCell(row.patient_name));
    tr.appendChild(textCell(row.file_number));
    tr.appendChild(textCell(row.admission_date));
    tr.appendChild(textCell(STATUS_LABELS[row.admission_status] ?? row.admission_status));

    const actionCell = document.createElement('td');
    const link = document.createElement('a');
    link.setAttribute('href', `visit-details.html?id=${row.visit_id}`);
    link.textContent = 'إدارة الإجراءات';
    actionCell.appendChild(link);
    tr.appendChild(actionCell);

    return tr;
  });

  tableBody.replaceChildren(...built);

  const isEmpty = built.length === 0;
  emptyState.classList.toggle('hidden', !isEmpty);
  countLabel.textContent = isEmpty ? '' : `${built.length} إقامة نشطة`;
}

async function load(searchTerm: string): Promise<void> {
  const seq = ++requestSeq;
  try {
    const rows = await listActiveVisits(searchTerm.trim() || undefined);
    if (seq !== requestSeq) return; // a newer search already answered
    setMessage('', 'idle');
    renderRows(rows);
  } catch (error: any) {
    if (seq !== requestSeq) return;
    setMessage(error.message, 'error');
  }
}

searchInput.addEventListener('input', () => {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void load(searchInput.value);
  }, DEBOUNCE_MS);
});

async function init(): Promise<void> {
  await load('');
}

void init();
