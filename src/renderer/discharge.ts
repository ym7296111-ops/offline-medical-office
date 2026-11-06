import { getVisitReport, type VisitProcedureRow } from './ipc-client';

const CATEGORY_LABELS: Record<string, string> = {
  radiology: 'أشعة',
  lab: 'تحاليل',
  ambulance: 'إسعاف'
};

const messageEl = document.getElementById('message') as HTMLParagraphElement;
const openWarning = document.getElementById('openWarning') as HTMLDivElement;

const patientNameEl = document.getElementById('patientName') as HTMLSpanElement;
const patientFileEl = document.getElementById('patientFile') as HTMLSpanElement;
const caseNumberEl = document.getElementById('caseNumber') as HTMLSpanElement;
const admissionDateEl = document.getElementById('admissionDate') as HTMLSpanElement;
const dischargeDateEl = document.getElementById('dischargeDate') as HTMLSpanElement;
const totalDaysEl = document.getElementById('totalDays') as HTMLSpanElement;

const tableBody = document.querySelector('#proceduresTable tbody') as HTMLTableSectionElement;
const emptyState = document.getElementById('emptyState') as HTMLParagraphElement;

const totalGrossEl = document.getElementById('totalGross') as HTMLSpanElement;
const patientShareEl = document.getElementById('patientShare') as HTMLSpanElement;
const insurerShareEl = document.getElementById('insurerShare') as HTMLSpanElement;

const btnPrint = document.getElementById('btnPrint') as HTMLButtonElement;

function setMessage(text: string, kind: 'ok' | 'error' | 'idle'): void {
  messageEl.textContent = text;
  messageEl.style.color = kind === 'error' ? 'red' : kind === 'ok' ? 'green' : '#222';
}

function formatMoney(value: number): string {
  return value.toLocaleString('en-US');
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
    tr.appendChild(
      textCell(CATEGORY_LABELS[row.procedure_category_snapshot] ?? row.procedure_category_snapshot)
    );
    tr.appendChild(textCell(String(row.quantity)));
    tr.appendChild(textCell(formatMoney(row.unit_price_snapshot)));
    tr.appendChild(textCell(formatMoney(row.row_total)));
    tr.appendChild(textCell(row.procedure_date));
    tr.appendChild(textCell(row.notes ?? '—'));
    return tr;
  });

  tableBody.replaceChildren(...built);
  const isEmpty = built.length === 0;
  emptyState.classList.toggle('hidden', !isEmpty);
}

function readVisitId(): number | null {
  const raw = new URLSearchParams(window.location.search).get('id');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function init(): Promise<void> {
  const visitId = readVisitId();
  if (visitId === null) {
    setMessage('لم يتم تحديد إقامة صالحة. استخدم: discharge.html?id=<رقم>', 'error');
    return;
  }

  try {
    const report = await getVisitReport(visitId);
    const visit = report.visit;

    patientNameEl.textContent = visit.patient_name;
    patientFileEl.textContent = visit.patient_file_number;
    caseNumberEl.textContent = visit.case_number;
    admissionDateEl.textContent = visit.admission_date;
    dischargeDateEl.textContent = visit.discharge_date ?? '—';
    totalDaysEl.textContent = visit.total_days === null ? '—' : String(visit.total_days);

    renderProcedures(report.procedures);

    totalGrossEl.textContent = formatMoney(visit.total_gross_amount);
    patientShareEl.textContent = formatMoney(visit.patient_share_amount);
    insurerShareEl.textContent = formatMoney(visit.insurer_share_amount);

    // WF-010: the final report requires a closed visit; an open one is provisional.
    if (visit.discharge_date === null) {
      openWarning.classList.remove('hidden');
    }
  } catch (error: any) {
    setMessage(error.message, 'error');
  }
}

btnPrint.addEventListener('click', () => {
  window.print();
});

void init();
