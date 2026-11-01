# البنية التقنية — Technical Architecture

> **الحالة:** قيد الإكمال (الدفعة 1 من 3 — البنية والطبقات والأمان).

> **اللغة:** TypeScript (إلزامي).

> **يعتمد على:** docs/scope.md، docs/03-data-dictionary.md، docs/04-erd.md، docs/05-workflows.md

## 1. نظرة عامة

التطبيق يستخدم نموذج Electron ثلاثي العمليات:

- **Main Process:** العملية الوحيدة التي تملك اتصالًا بقاعدة البيانات `better-sqlite3`)، وتدير الترخيص، والنسخ الاحتياطي، ونظام الملفات.

- **Preload Script:** جسر آمن بين Main وRenderer. يمرر استدعاءات IPC محددة فقط.

- **Renderer Process:** واجهة المستخدم (HTML/CSS/TypeScript). لا وصول مباشر إلى Node.js أو قاعدة البيانات.

**القاعدة الذهبية:** الواجهة لا تلمس قاعدة البيانات إطلاقًا. كل قراءة أو كتابة تمر عبر IPC.

## 2. نموذج الأمان

إعدادات `BrowserWindow` الإلزامية:

- `contextIsolation: true`

- `nodeIntegration: false`

- `sandbox: true` (حيث أمكن)

- `webSecurity: true`

- `preload` يحدد مسار الـ preload script فقط.

ممنوعات صريحة في الواجهة:

- لا `require()` لأي وحدة Node.js.

- لا `import` مباشر لـ `better-sqlite3` أو `fs` أو `path`.

- لا `remote` module.

- لا `eval()` ولا `new Function()`.

- لا تحميل محتوى خارجي `http://` أو `https://`) داخل التطبيق.

- Content Security Policy صارمة: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`.

## 3. هيكل المجلدات

```text

offline-medical-office/

├─ package.json

├─ tsconfig.json

├─ electron.vite.config.ts

├─ src/

│  ├─ main/

│  │  ├─ index.ts                 # نقطة دخول Main

│  │  ├─ window.ts                # إنشاء BrowserWindow

│  │  ├─ ipc/

│  │  │  ├─ register.ts           # تسجيل كل handlers

│  │  │  └─ handlers/             # ملف لكل مجموعة

│  │  ├─ db/

│  │  │  ├─ connection.ts         # فتح القاعدة + PRAGMAs

│  │  │  ├─ migrations/

│  │  │  │  ├─ runner.ts

│  │  │  │  └─ 001_initial.sql

│  │  │  └─ pragmas.ts

│  │  ├─ repositories/            # طبقة الوصول للبيانات

│  │  │  ├─ patients.repo.ts

│  │  │  ├─ visits.repo.ts

│  │  │  └─ ...

│  │  ├─ services/                # منطق الأعمال

│  │  │  ├─ visit.service.ts

│  │  │  ├─ billing.service.ts

│  │  │  ├─ discharge.service.ts

│  │  │  ├─ backup.service.ts

│  │  │  └─ licensing.service.ts

│  │  └─ utils/

│  ├─ preload/

│  │  └─ index.ts                 # contextBridge + IPC surface

│  ├─ renderer/

│  │  ├─ index.html

│  │  ├─ main.ts

│  │  ├─ pages/

│  │  ├─ components/

│  │  └─ ipc-client.ts            # wrapper آمن لاستدعاءات IPC

│  └─ shared/

│     ├─ types/                   # TypeScript interfaces

│     ├─ schemas/                 # zod schemas للتحقق من IPC

│     └─ constants.ts

├─ tests/

│  ├─ unit/

│  └─ integration/

└─ docs/
```

## 4. الطبقات والحدود

~~~text

┌─────────────────────────────────────────────┐

│  Renderer (UI)                              │

│  - HTML/CSS/TS                              │

│  - تستدعي ipc-client فقط                    │

└────────────────────┬────────────────────────┘

                     │ contextBridge

┌────────────────────▼────────────────────────┐

│  Preload                                    │

│  - يكشف API محددة عبر window.api            │

│  - لا منطق أعمال                            │

└────────────────────┬────────────────────────┘

                     │ ipcRenderer.invoke

┌────────────────────▼────────────────────────┐

│  Main — IPC Handlers                        │

│  - تستقبل الطلب                             │

│  - تتحقق من المدخلات عبر zod                │

│  - تفوّض إلى Services                       │

└────────────────────┬────────────────────────┘

                     │

┌────────────────────▼────────────────────────┐

│  Main — Services                            │

│  - منطق الأعمال                             │

│  - Transactions                             │

│  - تستدعي Repositories                      │

└────────────────────┬────────────────────────┘

                     │

┌────────────────────▼────────────────────────┐

│  Main — Repositories                        │

│  - SQL فقط                                  │

│  - لا منطق أعمال                            │

│  - تستخدم better-sqlite3                    │

└────────────────────┬────────────────────────┘

                     │

┌────────────────────▼────────────────────────┐

│  SQLite (better-sqlite3)                    │

│  - WAL mode                                 │

│  - foreign_keys = ON                        │

└─────────────────────────────────────────────┘

~~~

قواعد صارمة:

- **Renderer** لا يستورد أي شيء من `main/` أو `better-sqlite3`.

- **Preload** لا يحتوي منطق أعمال، فقط ربط IPC.

- **Services** هي المكان الوحيد لمنطق الأعمال والمعاملات (transactions).

- **Repositories** تحتوي SQL فقط، ولا تعرف قواعد العمل.

- **shared/** يحتوي أنواعًا مشتركة فقط، لا كود تنفيذي.

## 5. الاختيارات التقنية

| المكوّن | الاختيار | السبب |

|---|---|---|

| Build | electron-vite | يدعم TypeScript + Hot Reload + بناء 3 عمليات معًا |

| Database | better-sqlite3 | متزامن، سريع، ناضج في Electron |

| Validation | zod | تحقق runtime من مدخلات IPC |

| Logging | electron-log | ملفات دورية، مصمم لـ Electron |

| Testing | vitest | سريع، متوافق مع TypeScript |

| Packaging | electron-builder | ينتج Setup.exe مع elevation |

| Lint | eslint + @typescript-eslint | يكشف أخطاء الأنواع والحدود |

| Format | prettier | تنسيق موحد |

## 6. PRAGMAs الإلزامية

عند فتح اتصال بقاعدة البيانات، يجب تنفيذ:

- `PRAGMA foreign_keys = ON;`

- `PRAGMA journal_mode = WAL;`

- `PRAGMA synchronous = FULL;`

- `PRAGMA busy_timeout = 5000;`

- `PRAGMA temp_store = MEMORY;`

هذه تُنفَّذ في `src/main/db/connection.ts` عند كل فتح.

## 7. مسار قاعدة البيانات

- مسار الإنتاج: `app.getPath('userData')/medical.db`.

- لا يوضع أبدًا داخل مجلد التثبيت.

- ملفات WAL (-wal, -shm) تُدار تلقائيًا من SQLite، ولا تُنقل يدويًا.

## 8. ما لم يُحدَّد بعد (الدفعات 2 و3)

- نظام Migrations (منفّذ، رقم الإصدار، rollback).

- استراتيجية معالجة الأخطاء (error codes, user messages).

- استراتيجية السجلات (log levels, rotation, retention).

- استراتيجية الاختبارات (unit/integration coverage targets).

## 9. عقد IPC

### 9.1 قواعد التسمية

- Channel names: `{domain}:{action}`.
- Actions: `create`, `get`, `list`, `update`, `delete`, `toggle`, `search`, `listByVisit`, `addItem`, `updateItem`, `deleteItem`, `discharge`, `correct`, `trigger`, `getStatus`, `set`.
- All channels use `ipcRenderer.invoke` / `ipcMain.handle` (request/response). No fire-and-forget except log streaming.

### 9.2 غلاف الطلب والرد

~~~ts
interface IpcRequest<T> {
  payload: T;
}

type IpcResponse<T> =
  | { success: true; data: T }
  | { success: false; error: IpcError };

interface IpcError {
  code: string;
  message: string;
  details?: unknown;
}
~~~

- الواجهة لا تستقبل استثناءات خام. كل خطأ يُحوَّل إلى `IpcError` في Main قبل عبور IPC.
- `message` نص عربي موجّه للمستخدم. `details` اختيارية (مثل `zod` issues).

### 9.3 رموز الأخطاء

| Code | Meaning |
|---|---|
| VALIDATION_ERROR | مدخلات لا تطابق zod schema |
| NOT_FOUND | الكيان غير موجود |
| CONFLICT | قيد فريد أو حالة متعارضة (مثل إقامة مغلقة) |
| FOREIGN_KEY_ERROR | منع الحذف بسبب FK RESTRICT |
| LICENSING_ERROR | ترخيص غير صالح أو منتهٍ |
| BACKUP_ERROR | فشل النسخ الاحتياطي |
| INTERNAL_ERROR | خطأ غير متوقع (يُسجَّل كاملًا) |

### 9.4 سطح الـ Preload

~~~ts
window.api = {
  patients: { create, get, search, update },
  visits: { create, get, listActive, discharge, correct },
  visitProcedures: { add, update, delete, listByVisit },
  prescriptions: { create, addItem, updateItem, deleteItem, listByVisit },
  drugs: { create, update, toggle, list },
  procedures: { create, update, toggle, list },
  insuranceCompanies: { create, update, toggle, list },
  medicalEntities: { create, update, toggle, list },
  auditLog: { listByVisit },
  settings: { get, set },
  backup: { trigger, list, setDestination, getStatus },
  licensing: { status, activate },
};
~~~

- كل method تُعيد `Promise<IpcResponse<T>>`.

### 9.5 قائمة القنوات

| Domain | Channels |
|---|---|
| patients | patients:create, patients:get, patients:search, patients:update |
| visits | visits:create, visits:get, visits:listActive, visits:discharge, visits:correct |
| visit_procedures | visit_procedures:add, visit_procedures:update, visit_procedures:delete, visit_procedures:listByVisit |
| prescriptions | prescriptions:create, prescriptions:addItem, prescriptions:updateItem, prescriptions:deleteItem, prescriptions:listByVisit |
| drugs | drugs:create, drugs:update, drugs:toggle, drugs:list |
| procedures | procedures:create, procedures:update, procedures:toggle, procedures:list |
| insurance_companies | insurance_companies:create, insurance_companies:update, insurance_companies:toggle, insurance_companies:list |
| medical_entities | medical_entities:create, medical_entities:update, medical_entities:toggle, medical_entities:list |
| audit_log | audit_log:listByVisit |
| settings | settings:get, settings:set |
| backup | backup:trigger, backup:list, backup:setDestination, backup:getStatus |
| licensing | licensing:status, licensing:activate |

### 9.6 مثال كامل: إنشاء مريض

Zod schema في `src/shared/schemas/patient.ts`:

~~~ts
import { z } from 'zod';

export const CreatePatientInput = z.object({
  file_number: z.string().min(1).max(50),
  full_name: z.string().min(1).max(200),
  emergency_contact_phone: z.string().max(50).nullable(),
  companion_name: z.string().max(200).nullable(),
  relationship: z.string().max(100).nullable(),
});
export type CreatePatientInput = z.infer<typeof CreatePatientInput>;
~~~

Handler في `src/main/ipc/handlers/patients.ts`:

~~~ts
ipcMain.handle('patients:create', async (_event, raw) => {
  try {
    const input = CreatePatientInput.parse(raw);
    const patient = patientsService.create(input);
    return { success: true, data: patient };
  } catch (err) {
    return { success: false, error: toIpcError(err) };
  }
});
~~~

Preload في `src/preload/index.ts`:

~~~ts
contextBridge.exposeInMainWorld('api', {
  patients: {
    create: (input: CreatePatientInput) =>
      ipcRenderer.invoke('patients:create', input),
  },
});
~~~

Renderer wrapper في `src/renderer/ipc-client.ts`:

~~~ts
export async function createPatient(input: CreatePatientInput) {
  const response = await window.api.patients.create(input);
  if (!response.success) throw new IpcClientError(response.error);
  return response.data;
}
~~~

### 9.7 قواعد التحقق

- كل handler يتحقق من المدخلات عبر zod schema من `src/shared/schemas/`.
- Zod errors تُحوَّل إلى `IpcError` برمز `VALIDATION_ERROR`، وتفاصيل `error.issues`.
- لا يُقبل أي مدخل غير متحقق منه.

### 9.8 قواعد الاستثناءات

- لا يُسمح لاستثناء بالخروج من `ipcMain.handle` بدون تحويل.
- كل `catch` يستدعي `toIpcError(err)`.
- `toIpcError` يعرف: `ZodError` → `VALIDATION_ERROR`، `SqliteError` (FK) → `FOREIGN_KEY_ERROR`، `UNIQUE` → `CONFLICT`، إلخ.
- `INTERNAL_ERROR` يُسجَّل كاملًا في `electron-log`، ويُعاد للواجهة برسالة عامة فقط بلا stack trace.
