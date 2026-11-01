# الترخيص — Offline Hardware Licensing

> **الحالة:** مكتمل.
> **الطريقة:** ترخيص موقّع رقميًا، مرتبط ببصمة الجهاز، يعمل دون إنترنت.

## 1. المبادئ

- الترخيص أوفلاين بالكامل. لا اتصال بالإنترنت في أي مرحلة.
- الترخيص مرتبط ببصمة الجهاز (machine fingerprint).
- التوقيع الرقمي (Ed25519) يثبت المصدر. التشفير وحده (AES) لا يكفي.
- المفتاح الخاص لا يغادر جهاز المطوّر أبدًا.
- المفتاح العام مضمّن في التطبيق للتحقق.
- ترخيص واحد لكل جهاز. لا نقل بين الأجهزة.

## 2. بصمة الجهاز (Machine Fingerprint)

- المصدر: `node-machine-id` (motherboard/CPU UUID) + Windows Machine GUID.
- التطبيع: trim + lowercase.
- التجزئة: SHA-256.
- الناتج: hex string بطول 64 حرفًا.

~~~ts
import { machineIdSync } from 'node-machine-id';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

export function getMachineFingerprint(): string {
  const machineId = machineIdSync(true);
  const winGuid = execSync(
    'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid'
  ).toString().match(/[0-9a-f-]{36}/i)?.[0] ?? '';
  const raw = `${machineId.trim().toLowerCase()}|${winGuid.trim().toLowerCase()}`;
  return createHash('sha256').update(raw).digest('hex');
}
~~~

- يُحسب مرة واحدة عند بدء التطبيق، ويُخزَّن في الذاكرة.
- لا يُخزَّن في ملف (لتجنب العبث).

## 3. صيغة ملف الترخيص

ملف JSON يحتوي:

~~~json
{
  "version": 1,
  "license_id": "uuid-v4",
  "customer_name": "string",
  "machine_fingerprint": "hex64",
  "issued_at": "ISO8601",
  "expires_at": "ISO8601 | null",
  "features": ["base"],
  "signature": "base64-ed25519"
}
~~~

- `version`: إصدار صيغة الترخيص. يسمح بتطور مستقبلي.
- `license_id`: UUID فريد لكل ترخيص. يُستخدم للتتبع.
- `expires_at: null` = ترخيص دائم.
- `features`: قائمة الميزات المفعّلة. المرحلة الأولى: `["base"]` فقط.
- `signature`: توقيع Ed25519 على كل الحقول السابقة (JSON canonicalized).

## 4. التوقيع والتحقق

### 4.1 الخوارزمية

- Ed25519: سريع، مفاتيح قصيرة، آمن، مدعوم أصلًا في Node.js `crypto`.
- المفتاح الخاص في جهاز المطوّر فقط.
- المفتاح العام مضمّن في `src/main/licensing/public-key.ts`.

### 4.2 إصدار الترخيص (على جهاز المطوّر)

سكربت منفصل `tools/issue-license.ts` — لا يُشحن مع التطبيق:

~~~ts
import { sign, createPrivateKey, randomUUID } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const privateKey = createPrivateKey(readFileSync('./keys/private.pem', 'utf8'));

const body = {
  version: 1,
  license_id: randomUUID(),
  customer_name: process.argv[2],
  machine_fingerprint: process.argv[3],
  issued_at: new Date().toISOString(),
  expires_at: process.argv[4] || null,
  features: ['base'],
};

const canonical = JSON.stringify(body, Object.keys(body).sort());
const signature = sign(null, Buffer.from(canonical), privateKey).toString('base64');

mkdirSync('./licenses', { recursive: true });
writeFileSync(
  `./licenses/${body.license_id}.license`,
  JSON.stringify({ ...body, signature }, null, 2)
);
~~~

- canonicalization: ترتيب المفاتيح أبجديًا قبل التوقيع.
- السكربت في `tools/`، مستقل تمامًا عن التطبيق.

### 4.3 التحقق (داخل التطبيق)

~~~ts
import { verify, createPublicKey } from 'crypto';

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA...embedded...
-----END PUBLIC KEY-----`;

export function validateLicense(
  license: LicenseFile,
  currentFingerprint: string
): { valid: boolean; reason?: string } {
  const { signature, ...body } = license;
  const canonical = JSON.stringify(body, Object.keys(body).sort());
  const publicKey = createPublicKey(PUBLIC_KEY_PEM);

  const sigOk = verify(
    null,
    Buffer.from(canonical),
    publicKey,
    Buffer.from(signature, 'base64')
  );
  if (!sigOk) return { valid: false, reason: 'INVALID_SIGNATURE' };

  if (license.machine_fingerprint !== currentFingerprint) {
    return { valid: false, reason: 'FINGERPRINT_MISMATCH' };
  }

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return { valid: false, reason: 'EXPIRED' };
  }

  return { valid: true };
}
~~~

## 5. تدفق التفعيل الأوفلاين

1. المستخدم يثبّت التطبيق. عند أول تشغيل، لا يوجد ترخيص → شاشة "التفعيل".
2. الشاشة تعرض بصمة الجهاز (fingerprint) وزر "نسخ إلى ملف طلب".
3. ملف الطلب (`activation-request.json`) يحتوي: fingerprint + اسم الجهاز + تاريخ.
4. المستخدم يرسل الملف للمطوّر (بريد، واتساب، USB — أي وسيلة أوفلاين).
5. المطوّر يشغّل `tools/issue-license.ts` ويُعيد ملف `.license`.
6. المستخدم يستورد ملف الترخيص من الشاشة.
7. التطبيق يتحقق ويحفظ الملف في `C:\ProgramData\OfflineMedicalOffice\license.license`.
8. عند كل تشغيل، التطبيق يقرأ الملف ويتحقق. إذا فشل → شاشة التفعيل.

## 6. تخزين الترخيص

- المسار: `C:\ProgramData\OfflineMedicalOffice\license.license`.
- لماذا ProgramData وليس userData؟
  - ProgramData مشترك بين كل مستخدمي الجهاز. الترخيص للجهاز لا للمستخدم.
  - userData مرتبط بحساب Windows. مستخدم آخر لن يرى الترخيص.
- التطبيق يحتاج صلاحيات كتابة إلى ProgramData.
- تُمنح عبر installer (الأفضل) أو عند أول تفعيل (UAC prompt لمرة واحدة).

## 7. الحالات الحدّية

### 7.1 تغيير العتاد

- RAM / SSD / بطاقة شبكة: لا يؤثر. البصمة تعتمد على motherboard/CPU + Windows GUID.
- تغيير motherboard: البصمة تتغير → الترخيص يُرفض.
- الحل: المستخدم يرسل fingerprint الجديد. المطوّر يُصدر ترخيصًا بديلًا.

### 7.2 نسخ الترخيص إلى جهاز آخر

- fingerprint لا يطابق → يُرفض. لا يمكن نقل الترخيص.

### 7.3 تعديل ملف الترخيص

- التوقيع لا يطابق → يُرفض. حتى تغيير `expires_at` يكسر التوقيع.

### 7.4 تغيير ساعة الجهاز

- التطبيق يستخدم `expires_at` مع ساعة الجهاز.
- تقديم الساعة للأمام: الترخيص ينتهي مبكرًا (مقبول).
- تقديمها للخلف: لا يفيد مع الترخيص الدائم.
- لا حماية إضافية. لا اتصال بخادم وقت.

### 7.5 حذف ملف الترخيص

- عند التشغيل التالي، لا يوجد ملف → شاشة التفعيل.
- المستخدم يستورد نفس الملف مرة أخرى.

### 7.6 انتهاء الترخيص أثناء التشغيل

- التحقق يحدث عند بدء التشغيل فقط.
- لا يُغلق التطبيق فجأة.
- عند التشغيل التالي، يُرفض.

### 7.7 نسخ احتياطي واستعادة

- الترخيص لا يدخل في backup قاعدة البيانات (ملف منفصل).
- إذا أُعيد تثبيت Windows بالكامل: Windows GUID يتغير → البصمة تتغير → ترخيص جديد.

## 8. إدارة المفاتيح

### 8.1 المفتاح الخاص (Private Key)

- يُولَّد مرة واحدة: `openssl genpkey -algorithm ed25519 -out keys/private.pem`.
- يُحفظ في جهاز المطوّر فقط.
- يُحمى بكلمة مرور (passphrase).
- لا يُرفع إلى Git. `.gitignore` يستثني `keys/`، `*.pem`.
- نسخة احتياطية على USB مشفّر، منفصلة عن الجهاز.

### 8.2 المفتاح العام (Public Key)

- يُولَّد: `openssl pkey -in keys/private.pem -pubout -out keys/public.pem`.
- يُضمَّن في `src/main/licensing/public-key.ts` كـ string.
- يمكن أن يكون في Git. لا سرية فيه.
- يُحدَّث فقط عند تدوير المفاتيح.

### 8.3 تدوير المفاتيح

- إذا تسرب المفتاح الخاص: توليد زوج جديد، إصدار تراخيص جديدة لكل العملاء، إصدار نسخة جديدة من التطبيق بمفتاح عام محدث.
- إجراء مؤلم. حماية المفتاح الخاص أولوية قصوى.

## 9. حدود هذه المرحلة

- لا تفعيل عبر الإنترنت.
- لا تجربة مجانية (trial) في المرحلة الأولى.
- لا ترخيص لميزات متعددة. features = ["base"] فقط.
- لا خادم ترخيص. كل شيء عبر ملفات.
