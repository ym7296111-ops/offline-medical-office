CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  emergency_contact_phone TEXT,
  companion_name TEXT,
  relationship TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS insurance_companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  phone TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS medical_entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  entity_type TEXT,
  phone TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drugs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  current_price INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS procedures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('radiology', 'lab', 'ambulance')),
  current_price INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (name, category)
);

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  case_number TEXT NOT NULL UNIQUE,
  admission_date TEXT NOT NULL,
  discharge_date TEXT,
  admission_status TEXT NOT NULL CHECK (admission_status IN ('stable', 'critical', 'emergency', 'under_observation')),
  contract_type TEXT NOT NULL CHECK (contract_type IN ('private', 'insurance')),
  insurance_company_id INTEGER,
  patient_copay_percentage INTEGER NOT NULL DEFAULT 0 CHECK (patient_copay_percentage BETWEEN 0 AND 100),
  referred_entity_id INTEGER,
  referred_entity_name_snapshot TEXT,
  total_days INTEGER,
  total_gross_amount INTEGER NOT NULL DEFAULT 0,
  patient_share_amount INTEGER NOT NULL DEFAULT 0,
  insurer_share_amount INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE RESTRICT,
  FOREIGN KEY (insurance_company_id) REFERENCES insurance_companies(id) ON DELETE RESTRICT,
  FOREIGN KEY (referred_entity_id) REFERENCES medical_entities(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS visit_procedures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visit_id INTEGER NOT NULL,
  procedure_id INTEGER NOT NULL,
  procedure_name_snapshot TEXT NOT NULL,
  procedure_category_snapshot TEXT NOT NULL CHECK (procedure_category_snapshot IN ('radiology', 'lab', 'ambulance')),
  unit_price_snapshot INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  row_total INTEGER NOT NULL,
  procedure_date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE RESTRICT,
  FOREIGN KEY (procedure_id) REFERENCES procedures(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visit_id INTEGER NOT NULL,
  prescription_date TEXT NOT NULL,
  total_amount INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prescription_id INTEGER NOT NULL,
  drug_id INTEGER NOT NULL,
  drug_name_snapshot TEXT NOT NULL,
  unit_price_snapshot INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  row_total INTEGER NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE RESTRICT,
  FOREIGN KEY (drug_id) REFERENCES drugs(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visit_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('visit', 'visit_procedure', 'prescription', 'prescription_item')),
  entity_id INTEGER NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('insert', 'update', 'delete')),
  reason TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  performed_at TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
