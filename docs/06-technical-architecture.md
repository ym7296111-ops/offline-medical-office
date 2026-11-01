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

- عقد IPC التفصيلي (قنوات، أنواع الطلب/الرد).

- نظام Migrations (منفّذ، رقم الإصدار، rollback).

- استراتيجية معالجة الأخطاء (error codes, user messages).

- استراتيجية السجلات (log levels, rotation, retention).

- استراتيجية الاختبارات (unit/integration coverage targets).
