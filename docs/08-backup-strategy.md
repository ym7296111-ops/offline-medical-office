# استراتيجية النسخ الاحتياطي — Backup Strategy

> **الحالة:** مكتمل.
> **الطريقة:** snapshot آمن لقاعدة البيانات + ZIP + وجهة خارجية + سياسة احتفاظ.

## 1. المبادئ

- النسخ الاحتياطي أمان أساسي. فشل العملية يُسجَّل ويُبلَّغ، ولا يُتجاهل.
- لا نسخ ملف `medical.db` مباشرة أثناء عمل التطبيق. WAL و shm يجعلان النسخ المباشر غير آمن.
- النسخ يتم عبر SQLite Backup API أو `VACUUM INTO`.
- الوجهة خارجية (USB، قرص D:، مجلد شبكة محلي). لا تُخزَّن النسخ في نفس مجلد قاعدة البيانات.
- النسخة تُضغط (ZIP) لتوفير المساحة ولتسهيل النقل.
- سياسة احتفاظ تلقائية تحذف الأقدم بعد حد معين.

## 2. المسارات

- قاعدة البيانات الحية: `app.getPath('userData')/medical.db`.
- وجهة النسخ: يحددها المستخدم في `settings.backup_destination`.
- أمثلة:
  - `D:\Backups\MedicalOffice`
  - `E:\` (USB)
  - `\\server\share\medical-backups` (شبكة محلية)

## 3. آلية snapshot الآمن

### 3.1 الخيار (أ): SQLite Backup API (الموصى به)

`better-sqlite3` يدعم `db.backup(destination)`:

~~~ts
import Database from 'better-sqlite3';

async function createSnapshot(sourcePath: string, destPath: string) {
  const db = new Database(sourcePath, { readonly: true });
  try {
    await db.backup(destPath);
  } finally {
    db.close();
  }
}
~~~

- آمن أثناء عمل التطبيق.
- ينسخ حالة متسقة.
- يدمج WAL تلقائيًا في الصورة.

### 3.2 الخيار (ب): VACUUM INTO

~~~ts
db.exec(`VACUUM INTO '${escapeSqlString(destPath)}'`);
~~~

- بديل إذا فشل Backup API.
- ينتج ملفًا نظيفًا.
- قد يكون أبطأ على قواعد كبيرة.

### 3.3 ما لا يُفعل

- ❌ نسخ `medical.db` بـ `fs.copyFile` أثناء التشغيل.
- ❌ نسخ `medical.db` مع `-wal` و`-shm` يدويًا.
- ❌ ضغط الملفات الحية.

## 4. التدفق الكامل

1. التحقق من `backup_destination` في `settings`. إن غاب → خطأ BACKUP_ERROR.
2. التحقق من وجود الوجهة (USB موصول، قرص D: موجود).
3. إنشاء ملف مؤقت: `medical-YYYY-MM-DD_HH-MM.db`.
4. تنفيذ snapshot عبر Backup API إلى الملف المؤقت.
5. ضغط إلى `medical-YYYY-MM-DD_HH-MM.zip` باستخدام `archiver` أو `adm-zip`.
6. نسخ ZIP إلى الوجهة.
7. حذف الملف المؤقت.
8. تطبيق سياسة الاحتفاظ: حذف أقدم النسخ التي تتجاوز `backup_retention_days`.
9. تسجيل العملية في `electron-log` بمستوى `info` (نجاح) أو `error` (فشل).

~~~ts
async function runBackup(): Promise<BackupResult> {
  const dest = getSetting('backup_destination');
  if (!dest) return { success: false, error: 'NO_DESTINATION' };
  if (!await pathExists(dest)) return { success: false, error: 'DESTINATION_UNAVAILABLE' };

  const timestamp = formatTimestamp(new Date());
  const tmpDb = path.join(app.getPath('temp'), `medical-${timestamp}.db`);
  const zipPath = path.join(dest, `medical-${timestamp}.zip`);

  try {
    await createSnapshot(getDbPath(), tmpDb);
    await zipFile(tmpDb, zipPath);
    await removeFile(tmpDb);
    await enforceRetention(dest);
    logger.info(`Backup success: ${zipPath}`);
    return { success: true, path: zipPath };
  } catch (err) {
    logger.error('Backup failed', err);
    return { success: false, error: 'BACKUP_FAILED' };
  }
}
~~~

## 5. سياسة الاحتفاظ

- `settings.backup_retention_days` — الافتراضي: 30 يومًا.
- بعد كل نسخة ناجحة:
  - قراءة كل ملفات `.zip` في الوجهة.
  - استخراج التاريخ من اسم الملف.
  - حذف ما تجاوز الحد.
- لا يُحذف أي ملف لا يطابق نمط الاسم (حماية من حذف ملفات أخرى).

## 6. الجدولة

- النسخ التلقائي عند بدء التطبيق (مرة يوميًا).
- تحقق من آخر نسخة ناجحة. إن مرت أكثر من 24 ساعة → نسخة جديدة.
- زر "نسخ الآن" في الواجهة لنسخة يدوية فورية.
- النسخة التلقائية لا تعطّل بدء التطبيق: تعمل في الخلفية بعد تحميل الواجهة.

## 7. الاستعادة

- ليست ضمن المرحلة الأولى تلقائيًا. تتم يدويًا:
  1. إغلاق التطبيق.
  2. فك ZIP.
  3. نسخ `medical-*.db` إلى `app.getPath('userData')/medical.db`.
  4. حذف `medical.db-wal` و`medical.db-shm` إن وجدا.
  5. إعادة تشغيل التطبيق.
- نسخة جديدة من التطبيق ستوفر "استعادة" داخل الواجهة (خارج النطاق الآن).

## 8. الحالات الحدّية

### 8.1 لا وجهة محددة
- النسخة اليدوية: رسالة "الرجاء تحديد وجهة النسخ".
- النسخة التلقائية: تُسجَّل بـ `warn`. لا تُظهر إزعاجًا.

### 8.2 الوجهة غير متاحة (USB مفصول، قرص غير موجود)
- النسخة اليدوية: رسالة واضحة.
- النسخة التلقائية: `warn`، لا محاولة أخرى حتى دورة بدء التطبيق التالية.

### 8.3 القرص ممتلئ
- فشل ZIP أو النسخ → `BACKUP_FAILED`.
- لا يُحذف الملف المؤقت تلقائيًا في هذه الحالة (للمراجعة).

### 8.4 فشل في منتصف العملية
- لا يُحذف أي نسخة قديمة.
- سياسة الاحتفاظ تُطبَّق فقط بعد نجاح النسخة الجديدة.
- الملفات المؤقتة القديمة (`.db` غير مضغوط) تُنظَّف في بدء التطبيق التالي.

### 8.5 انقطاع الكهرباء أثناء النسخ
- القاعدة الحية سليمة (WAL يحميها).
- النسخة الجديدة قد تكون ناقصة: تُحذف عند فحص بدء التشغيل التالي (ملفات `.zip` غير مكتملة تُكتشف بحجم صفر أو فشل فك الضغط).

### 8.6 نسخ متزامن (يدوي + تلقائي)
- قفل (mutex) داخلي يمنع نسختين متزامنتين.
- الثانية تنتظر أو تُلغى برسالة "نسخة قيد التنفيذ".

### 8.7 صلاحيات الكتابة
- المستخدم قد لا يملك صلاحية على الوجهة → `BACKUP_FAILED` مع رسالة واضحة.

## 9. التحقق من سلامة النسخة

بعد إنشاء ZIP:

1. التأكد من حجم الملف > 0.
2. فتح ZIP والتحقق من وجود `medical-*.db` بداخله.
3. فتح `medical.db` للقراءة فقط (`readonly: true`) والتأكد من عمل `PRAGMA integrity_check`.
4. أي فشل → تُعتبر النسخة فاشلة، ولا تدخل سياسة الاحتفاظ.

## 10. حدود هذه المرحلة

- لا استعادة تلقائية من الواجهة.
- لا تشفير ZIP. النسخة غير مشفرة، ويجب أن تكون الوجهة آمنة فيزيائيًا.
- لا رفع سحابي.
- لا نسخ تزايدي (full backup فقط).
- لا نسخ متعدد الوجهات في نفس الدورة.
