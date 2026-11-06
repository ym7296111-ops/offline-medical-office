import {
  createInsuranceCompany,
  createMedicalEntity,
  listInsuranceCompanies,
  listMedicalEntities,
  toggleInsuranceCompany,
  toggleMedicalEntity,
  type InsuranceCompanyRow,
  type MedicalEntityRow
} from './ipc-client';

const insuranceForm = document.getElementById('insuranceForm') as HTMLFormElement;
const insuranceName = document.getElementById('insurance_name') as HTMLInputElement;
const insurancePhone = document.getElementById('insurance_phone') as HTMLInputElement;
const insuranceMessage = document.getElementById('insuranceMessage') as HTMLParagraphElement;
const insuranceBody = document.querySelector('#insuranceTable tbody') as HTMLTableSectionElement;

const entityForm = document.getElementById('entityForm') as HTMLFormElement;
const entityName = document.getElementById('entity_name') as HTMLInputElement;
const entityPhone = document.getElementById('entity_phone') as HTMLInputElement;
const entityMessage = document.getElementById('entityMessage') as HTMLParagraphElement;
const entityBody = document.querySelector('#entityTable tbody') as HTMLTableSectionElement;

function setMessage(el: HTMLElement, text: string, kind: 'ok' | 'error' | 'idle'): void {
  el.textContent = text;
  el.style.color = kind === 'error' ? 'red' : kind === 'ok' ? 'green' : 'black';
}

/** Builds a table cell holding plain text — never parsed as HTML. */
function textCell(value: string | null): HTMLTableCellElement {
  const td = document.createElement('td');
  td.textContent = value === null || value === '' ? '—' : value;
  return td;
}

interface CatalogRow {
  id: number;
  name: string;
  phone: string | null;
  is_active: 0 | 1;
}

function renderRow(
  row: CatalogRow,
  onToggle: (id: number) => void
): HTMLTableRowElement {
  const tr = document.createElement('tr');
  if (row.is_active === 0) tr.classList.add('inactive');

  tr.appendChild(textCell(row.name));
  tr.appendChild(textCell(row.phone));

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
  btn.addEventListener('click', () => onToggle(row.id));
  tdAction.appendChild(btn);
  tr.appendChild(tdAction);

  return tr;
}

async function loadInsurance(): Promise<void> {
  try {
    const rows = await listInsuranceCompanies();
    const trs = rows.map((row: InsuranceCompanyRow) =>
      renderRow(row, async (id) => {
        try {
          await toggleInsuranceCompany(id);
          await loadInsurance();
        } catch (error: any) {
          setMessage(insuranceMessage, error.message, 'error');
        }
      })
    );
    insuranceBody.replaceChildren(...trs);
  } catch (error: any) {
    setMessage(insuranceMessage, error.message, 'error');
  }
}

async function loadEntities(): Promise<void> {
  try {
    const rows = await listMedicalEntities();
    const trs = rows.map((row: MedicalEntityRow) =>
      renderRow(row, async (id) => {
        try {
          await toggleMedicalEntity(id);
          await loadEntities();
        } catch (error: any) {
          setMessage(entityMessage, error.message, 'error');
        }
      })
    );
    entityBody.replaceChildren(...trs);
  } catch (error: any) {
    setMessage(entityMessage, error.message, 'error');
  }
}

insuranceForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setMessage(insuranceMessage, 'جاري الحفظ...', 'idle');
  try {
    await createInsuranceCompany({
      name: insuranceName.value,
      phone: insurancePhone.value || null
    });
    insuranceName.value = '';
    insurancePhone.value = '';
    setMessage(insuranceMessage, 'تمت الإضافة بنجاح!', 'ok');
    await loadInsurance();
  } catch (error: any) {
    setMessage(insuranceMessage, error.message, 'error');
  }
});

entityForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setMessage(entityMessage, 'جاري الحفظ...', 'idle');
  try {
    await createMedicalEntity({
      name: entityName.value,
      phone: entityPhone.value || null
    });
    entityName.value = '';
    entityPhone.value = '';
    setMessage(entityMessage, 'تمت الإضافة بنجاح!', 'ok');
    await loadEntities();
  } catch (error: any) {
    setMessage(entityMessage, error.message, 'error');
  }
});

// Initial load
loadInsurance();
loadEntities();
