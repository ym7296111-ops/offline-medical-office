# قاموس البيانات — Data Dictionary

> **الحالة:** هيكل مبدئي. تفاصيل الحقول تُضاف في مرحلة لاحقة.

## قواعد التصميم العامة

- **المال:** يُخزَّن كـ `INTEGER` بأصغر وحدة نقدية (قرش/سنت). لا يُستخدم `FLOAT` إطلاقًا.

- **الحذف:** Soft-delete فقط عبر `is_active = 0`. لا حذف فعلي للكيانات التاريخية.

- **اللقطات (Snapshots):** أي سعر أو اسم يُستخدم في فاتورة يُحفظ كلقطة داخل بند الحالة، ولا يتأثر بتغيّر الكتالوج لاحقًا.

- **التواريخ:** `TEXT` بصيغة ISO 8601 `YYYY-MM-DD` للتواريخ، `YYYY-MM-DD HH:MM:SS` للطوابع الزمنية).

- **المفاتيح الأساسية:** `INTEGER PRIMARY KEY AUTOINCREMENT` (ما عدا `settings`).

- **المفاتيح الأجنبية:** `ON DELETE RESTRICT` في كل علاقة تاريخية. لا `CASCADE` أبدًا.

- **الترميز:** UTF-8. أسماء الحقول snake_case، بالإنجليزية.

- **Pragmas:** `PRAGMA foreign_keys = ON` `PRAGMA journal_mode = WAL` في كل اتصال.

## الجداول

### الطبقة 1 — الكتالوجات

#### 1. patients

- **الغرض:** البيانات الدائمة للمريض.

- **المفتاح الأساسي:** id

- **قيد فريد:** file_number

- **الحذف:** Soft-delete عبر is_active

#### 2. insurance_companies

- **الغرض:** كتالوج شركات التأمين.

- **المفتاح الأساسي:** id

- **قيد فريد:** name

- **الحذف:** Soft-delete

#### 3. medical_entities

- **الغرض:** كتالوج الجهات المحوّلة (مستشفيات).

- **المفتاح الأساسي:** id

- **قيد فريد:** name

- **الحذف:** Soft-delete

#### 4. drugs

- **الغرض:** كتالوج الأدوية مع آخر تسعير.

- **المفتاح الأساسي:** id

- **قيد فريد:** name

- **الحذف:** Soft-delete

#### 5. procedures

- **الغرض:** كتالوج الإجراءات غير العلاجية (أشعة، تحاليل، إسعاف).

- **المفتاح الأساسي:** id

- **قيد فريد مركّب:** (name, category)

- **العمود المميز:** category — القيم: `radiology` | `lab` | `ambulance`

- **الحذف:** Soft-delete

### الطبقة 2 — البيانات الحركية

#### 6. visits

- **الغرض:** الإقامة، من الدخول إلى الخروج.

- **المفتاح الأساسي:** id

- **قيد فريد:** case_number (فريد عالميًا — D-004)

- **المفاتيح الأجنبية:**

  - patient_id → patients.id (RESTRICT)

  - insurance_company_id → insurance_companies.id (RESTRICT، nullable)

  - referred_entity_id → medical_entities.id (RESTRICT، nullable)

- **الحذف:** لا حذف. الإغلاق عبر discharge_date.

#### 7. visit_procedures

- **الغرض:** بنود الأشعة والتحاليل والإسعاف داخل الإقامة.

- **المفتاح الأساسي:** id

- **المفاتيح الأجنبية:**

  - visit_id → visits.id (RESTRICT)

  - procedure_id → procedures.id (RESTRICT)

- **خصائص:** كل بند له تاريخ مستقل، وسعر لقطة.

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
