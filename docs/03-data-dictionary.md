# قاموس البيانات — Data Dictionary

> **الحالة:** هيكل مبدئي. تفاصيل الحقول تُضاف في مرحلة لاحقة.

## قواعد التصميم العامة

- **المال:** يُخزَّن كـ `INTEGER` بأصغر وحدة نقدية (قرش/سنت). لا يُستخدم `FLOAT` إطلاقًا.

- **الحذف:** Soft-delete فقط عبر `is_active = 0`. لا حذف فعلي للكيانات التاريخية.

- **اللقطات (Snapshots):** أي سعر أو اسم يُستخدم في فاتورة يُحفظ كلقطة داخل بند الحالة، ولا يتأثر بتغيّر الكتالوج لاحقًا.

- **التواريخ:** `TEXT` بصيغة ISO 8601: `YYYY-MM-DD` للتواريخ، `YYYY-MM-DD HH:MM:SS` للطوابع الزمنية.

- **المفاتيح الأساسية:** `INTEGER PRIMARY KEY AUTOINCREMENT` (ما عدا `settings`).

- **المفاتيح الأجنبية:** `ON DELETE RESTRICT` في كل علاقة تاريخية. لا `CASCADE` أبدًا.

- **الترميز:** UTF-8. أسماء الحقول snake_case، بالإنجليزية.

- **Pragmas:** `PRAGMA foreign_keys = ON` `PRAGMA journal_mode = WAL` في كل اتصال.

## الجداول

### الطبقة 1 — الكتالوجات

#### 1. patients

- **الغرض:** البيانات الدائمة للمريض.

- **الحذف:** Soft-delete عبر is_active.

| الحقل | النوع | القيود | ملاحظات |
|---|---|---|---|
| id | INTEGER | PK AUTOINCREMENT | |
| file_number | TEXT | NOT NULL, UNIQUE | رقم الملف الثابت |
| full_name | TEXT | NOT NULL | الاسم الكامل |
| emergency_contact_phone | TEXT | NULL | هاتف الطوارئ |
| companion_name | TEXT | NULL | اسم المرافق |
| relationship | TEXT | NULL | صلة القرابة |
| is_active | INTEGER | NOT NULL, DEFAULT 1, CHECK IN (0,1) | |
| created_at | TEXT | NOT NULL | ISO 8601 |
| updated_at | TEXT | NOT NULL | ISO 8601 |

#### 2. insurance_companies

- **الغرض:** كتالوج شركات التأمين.

- **الحذف:** Soft-delete.

| الحقل | النوع | القيود | ملاحظات |
|---|---|---|---|
| id | INTEGER | PK AUTOINCREMENT | |
| name | TEXT | NOT NULL, UNIQUE | اسم الشركة |
| phone | TEXT | NULL | |
| notes | TEXT | NULL | |
| is_active | INTEGER | NOT NULL, DEFAULT 1, CHECK IN (0,1) | |
| created_at | TEXT | NOT NULL | ISO 8601 |
| updated_at | TEXT | NOT NULL | ISO 8601 |

#### 3. medical_entities

- **الغرض:** كتالوج الجهات المحوّلة.

- **الحذف:** Soft-delete.

| الحقل | النوع | القيود | ملاحظات |
|---|---|---|---|
| id | INTEGER | PK AUTOINCREMENT | |
| name | TEXT | NOT NULL, UNIQUE | اسم الجهة |
| entity_type | TEXT | NULL | اختياري: hospital / clinic / lab |
| phone | TEXT | NULL | |
| notes | TEXT | NULL | |
| is_active | INTEGER | NOT NULL, DEFAULT 1, CHECK IN (0,1) | |
| created_at | TEXT | NOT NULL | ISO 8601 |
| updated_at | TEXT | NOT NULL | ISO 8601 |

#### 4. drugs

- **الغرض:** كتالوج الأدوية مع آخر تسعير.

- **الحذف:** Soft-delete.

| الحقل | النوع | القيود | ملاحظات |
|---|---|---|---|
| id | INTEGER | PK AUTOINCREMENT | |
| name | TEXT | NOT NULL, UNIQUE | اسم الدواء |
| current_price | INTEGER | NOT NULL, DEFAULT 0 | بالقرش/السنت — آخر تسعير |
| is_active | INTEGER | NOT NULL, DEFAULT 1, CHECK IN (0,1) | |
| created_at | TEXT | NOT NULL | ISO 8601 |
| updated_at | TEXT | NOT NULL | ISO 8601 |

#### 5. procedures

- **الغرض:** كتالوج الإجراءات غير العلاجية.

- **الحذف:** Soft-delete.

| الحقل | النوع | القيود | ملاحظات |
|---|---|---|---|
| id | INTEGER | PK AUTOINCREMENT | |
| name | TEXT | NOT NULL | اسم الإجراء |
| category | TEXT | NOT NULL, CHECK IN ('radiology','lab','ambulance') | يميز النوع |
| current_price | INTEGER | NOT NULL, DEFAULT 0 | بالقرش/السنت — آخر تسعير |
| is_active | INTEGER | NOT NULL, DEFAULT 1, CHECK IN (0,1) | |
| created_at | TEXT | NOT NULL | ISO 8601 |
| updated_at | TEXT | NOT NULL | ISO 8601 |

- **قيد فريد مركّب:** UNIQUE (name, category)

### الطبقة 2 — البيانات الحركية

#### 6. visits

- **الغرض:** الإقامة، من الدخول إلى الخروج.

- **الحذف:** لا حذف. الإغلاق عبر discharge_date.

| الحقل | النوع | القيود | ملاحظات |
|---|---|---|---|
| id | INTEGER | PK AUTOINCREMENT | |
| patient_id | INTEGER | NOT NULL, FK → patients.id (RESTRICT) | |
| case_number | TEXT | NOT NULL, UNIQUE | فريد عالميًا (D-004)، يُولَّد تلقائيًا |
| admission_date | TEXT | NOT NULL | ISO 8601 |
| discharge_date | TEXT | NULL | NULL = إقامة نشطة |
| admission_status | TEXT | NOT NULL, CHECK IN ('stable','critical','emergency','under_observation') | |
| contract_type | TEXT | NOT NULL, CHECK IN ('private','insurance') | |
| insurance_company_id | INTEGER | NULL, FK → insurance_companies.id (RESTRICT) | إلزامي عندما contract_type = 'insurance' |
| patient_copay_percentage | INTEGER | NOT NULL, DEFAULT 0, CHECK BETWEEN 0 AND 100 | يدعم شامل (0) وغير شامل (0-100) مستقبلًا |
| referred_entity_id | INTEGER | NULL, FK → medical_entities.id (RESTRICT) | |
| referred_entity_name_snapshot | TEXT | NULL | لقطة اسم الجهة وقت الدخول |
| total_days | INTEGER | NULL | NULL = إقامة نشطة، ≥1 بعد الخروج |
| total_gross_amount | INTEGER | NOT NULL, DEFAULT 0 | بالقرش/السنت، يُحدَّث عند تغيّر البنود |
| patient_share_amount | INTEGER | NOT NULL, DEFAULT 0 | بالقرش/السنت |
| insurer_share_amount | INTEGER | NOT NULL, DEFAULT 0 | بالقرش/السنت |
| notes | TEXT | NULL | |
| created_at | TEXT | NOT NULL | ISO 8601 |
| updated_at | TEXT | NOT NULL | ISO 8601 |

#### 7. visit_procedures

- **الغرض:** بنود الأشعة والتحاليل والإسعاف داخل الإقامة.

- **الحذف:** لا حذف تاريخي. التصحيح عبر audit_log (D-006).

| الحقل | النوع | القيود | ملاحظات |
|---|---|---|---|
| id | INTEGER | PK AUTOINCREMENT | |
| visit_id | INTEGER | NOT NULL, FK → visits.id (RESTRICT) | |
| procedure_id | INTEGER | NOT NULL, FK → procedures.id (RESTRICT) | |
| procedure_name_snapshot | TEXT | NOT NULL | لقطة اسم الإجراء |
| procedure_category_snapshot | TEXT | NOT NULL, CHECK IN ('radiology','lab','ambulance') | لقطة التصنيف |
| unit_price_snapshot | INTEGER | NOT NULL | بالقرش/السنت، لقطة السعر |
| quantity | INTEGER | NOT NULL, DEFAULT 1, CHECK > 0 | |
| row_total | INTEGER | NOT NULL | unit_price_snapshot × quantity |
| procedure_date | TEXT | NOT NULL | مستقل عن admission_date |
| notes | TEXT | NULL | |
| created_at | TEXT | NOT NULL | ISO 8601 |
| updated_at | TEXT | NOT NULL | ISO 8601 |

- **لا قيد فريد** على (visit_id, procedure_id): الإسعاف والتحاليل قد تتكرر في نفس اليوم.

#### 8. prescriptions

- **الغرض:** بند العلاج داخل الإقامة، يحتوي روشتة بداخله (D-005).

- **المفتاح الأساسي:** id

- **المفتاح الأجنبي:** visit_id → visits.id (RESTRICT)

- **العلاقة:** One-to-Many مع prescription_items

#### 9. prescription_items

- **الغرض:** الأدوية داخل الروشتة.

- **المفتاح الأساسي:** id

- **المفاتيح الأجنبية:**

  - prescription_id → prescriptions.id (RESTRICT)

  - drug_id → drugs.id (RESTRICT)

- **خصائص:** اسم الدواء وسعره محفوظان كلقطة.

### الطبقة 3 — النظام

#### 10. audit_log

- **الغرض:** تسجيل التصحيحات الإدارية بعد الخروج (D-006).

- **المفتاح الأساسي:** id

- **المفتاح الأجنبي:** visit_id → visits.id (RESTRICT، nullable)

- **محتويات إلزامية:** من، متى، ماذا، لماذا.

#### 11. settings

- **الغرض:** إعدادات التطبيق.

- **المفتاح الأساسي:** key (TEXT)

- **أمثلة:** backup_destination, backup_retention_days

## العلاقات الرئيسية

- patient (1) → (N) visits

- visit (1) → (N) visit_procedures

- visit (1) → (N) prescriptions

- prescription (1) → (N) prescription_items

- visit (1) → (N) audit_log

- insurance_company (1) → (N) visits

- medical_entity (1) → (N) visits

- procedure (1) → (N) visit_procedures

- drug (1) → (N) prescription_items

## ما لم يُحدَّد بعد

- تفاصيل كل حقل (النوع، الطول، NOT NULL، DEFAULT، CHECK).

- الفهارس (Indexes).

- القيود المركّبة (Composite constraints).

هذه تُضاف في المرحلة التالية (03-data-dictionary — Field Definitions).
