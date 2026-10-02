import { normalizeCnic, normalizePhone } from '@/lib/validation/common';
import { parseDate, summarise, type ColSpec, type Report, type RowResult, readTable } from './engine';

// ───────────────────────── students ─────────────────────────
export const STUDENT_COLS: ColSpec[] = [
  { key: 'full_name', label: 'Student name', required: true, example: 'Ayesha Noor', aliases: ['name', 'full name'] },
  { key: 'gender', label: 'Gender', required: true, example: 'female' },
  { key: 'dob', label: 'Date of birth', example: '2016-04-21', aliases: ['dob'] },
  { key: 'class', label: 'Class', required: true, example: 'Class 3' },
  { key: 'section', label: 'Section', example: 'A' },
  { key: 'admission_no', label: 'Admission no', example: '', aliases: ['admission number'] },
  { key: 'roll_no', label: 'Roll no', example: '12', aliases: ['roll number'] },
  { key: 'b_form_no', label: 'B-Form', example: '35202-1234567-1', aliases: ['bform', 'b form no', 'cnic'] },
  { key: 'father_name', label: 'Father name', example: 'Muhammad Tariq' },
  { key: 'mother_name', label: 'Mother name', example: '' },
  { key: 'g_name', label: 'Guardian name', required: true, example: 'Muhammad Tariq', aliases: ['guardian', 'parent name'] },
  { key: 'g_phone', label: 'Guardian phone', required: true, example: '0300-1234567', aliases: ['phone', 'mobile', 'parent phone'] },
  { key: 'g_relation', label: 'Relation', example: 'father' },
  { key: 'g_cnic', label: 'Guardian CNIC', example: '' },
  { key: 'address', label: 'Address', example: '12-B Johar Town' },
  { key: 'city', label: 'City', example: 'Lahore' },
  { key: 'blood_group', label: 'Blood group', example: 'B+' },
  { key: 'admission_date', label: 'Admission date', example: '2026-04-01' },
];

export interface StudentLookups {
  classes: Map<string, string>;                    // lower(name) → id
  sections: Map<string, string>;                   // `${classId}|${lower(name)}` → id
  existingAdmissionNos: Set<string>;
  existingBForms: Set<string>;
}
const BLOOD = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

export function validateStudents(csv: string, lk: StudentLookups): Report {
  const { rows, headerErrors, unknownHeaders } = readTable(csv, STUDENT_COLS);
  const seenAdm = new Set<string>(), seenBForm = new Set<string>();
  const out: RowResult[] = rows.map(({ line, raw }) => {
    const errors: string[] = [];
    let status: RowResult['status'] = 'valid';
    if (!raw.full_name) errors.push('Student name is required.');
    const gender = ({ m: 'male', male: 'male', boy: 'male', f: 'female', female: 'female', girl: 'female', other: 'other' } as Record<string, string>)[raw.gender!.toLowerCase()];
    if (!gender) errors.push('Gender must be male, female or other.');
    const classId = lk.classes.get(raw.class!.toLowerCase());
    if (!raw.class) errors.push('Class is required.'); else if (!classId) errors.push(`Class "${raw.class}" does not exist in this campus.`);
    let sectionId: string | undefined;
    if (raw.section) { sectionId = classId ? lk.sections.get(`${classId}|${raw.section.toLowerCase()}`) : undefined; if (classId && !sectionId) errors.push(`Section "${raw.section}" does not exist in ${raw.class}.`); }
    if (!raw.g_name) errors.push('Guardian name is required.');
    const phone = normalizePhone(raw.g_phone!);
    if (!raw.g_phone) errors.push('Guardian phone is required.'); else if (!/^\d{9,15}$/.test(phone)) errors.push('Guardian phone is not a valid number.');
    let dob: string | null = null;
    if (raw.dob) { dob = parseDate(raw.dob); if (!dob) errors.push('Date of birth must look like 2016-04-21 or 21/04/2016.'); }
    let admDate: string | null = null;
    if (raw.admission_date) { admDate = parseDate(raw.admission_date); if (!admDate) errors.push('Admission date is not a valid date.'); }
    const bform = raw.b_form_no ? normalizeCnic(raw.b_form_no) : '';
    if (bform && !/^\d{5}-\d{7}-\d$/.test(bform)) errors.push('B-Form must be 13 digits.');
    const gcnic = raw.g_cnic ? normalizeCnic(raw.g_cnic) : '';
    if (gcnic && !/^\d{5}-\d{7}-\d$/.test(gcnic)) errors.push('Guardian CNIC must be 13 digits.');
    const blood = raw.blood_group ? raw.blood_group.toUpperCase() : '';
    if (blood && !BLOOD.has(blood)) errors.push('Blood group must be like A+, O-, AB+.');
    const relation = raw.g_relation ? raw.g_relation.toLowerCase() : 'father';
    if (!['father', 'mother', 'guardian', 'other'].includes(relation)) errors.push('Relation must be father, mother, guardian or other.');

    if (raw.admission_no) {
      const k = raw.admission_no.toLowerCase();
      if (lk.existingAdmissionNos.has(k)) { errors.push('Admission number already exists in the system.'); status = 'duplicate'; }
      else if (seenAdm.has(k)) { errors.push('Admission number is repeated in this file.'); status = 'duplicate'; }
      seenAdm.add(k);
    }
    if (bform) {
      if (lk.existingBForms.has(bform)) { errors.push('A student with this B-Form already exists.'); status = 'duplicate'; }
      else if (seenBForm.has(bform)) { errors.push('B-Form is repeated in this file.'); status = 'duplicate'; }
      seenBForm.add(bform);
    }
    if (errors.length && status === 'valid') status = 'invalid';
    const data = status === 'valid' ? {
      full_name: raw.full_name, gender, dob: dob ?? undefined, class_id: classId, section_id: sectionId, admission_no: raw.admission_no || undefined, roll_no: raw.roll_no || undefined,
      b_form_no: bform || undefined, father_name: raw.father_name || undefined, mother_name: raw.mother_name || undefined, g_name: raw.g_name, g_phone: phone, g_relation: relation,
      g_cnic: gcnic || undefined, address: raw.address || undefined, city: raw.city || undefined, blood_group: blood || undefined, admission_date: admDate ?? undefined,
    } : undefined;
    return { line, raw, data, errors, status };
  });
  return { headerErrors, unknownHeaders, rows: out, counts: summarise(out) };
}

// ───────────────────────── staff ─────────────────────────
export const STAFF_COLS: ColSpec[] = [
  { key: 'full_name', label: 'Staff name', required: true, example: 'Sidra Parveen', aliases: ['name'] },
  { key: 'gender', label: 'Gender', example: 'female' },
  { key: 'cnic', label: 'CNIC', example: '35202-1234567-1' },
  { key: 'phone', label: 'Phone', required: true, example: '0300-1234567', aliases: ['mobile'] },
  { key: 'email', label: 'Email', example: '' },
  { key: 'designation', label: 'Designation', example: 'Teacher' },
  { key: 'department', label: 'Department', example: 'Languages' },
  { key: 'joining_date', label: 'Joining date', example: '2024-08-01' },
  { key: 'qualification', label: 'Qualification', example: 'M.A., B.Ed' },
  { key: 'employment_type', label: 'Employment type', example: 'permanent' },
  { key: 'employee_code', label: 'Employee ID', example: '', aliases: ['employee code'] },
];
export function validateStaff(csv: string, existing: { codes: Set<string>; cnics: Set<string> }): Report {
  const { rows, headerErrors, unknownHeaders } = readTable(csv, STAFF_COLS);
  const seen = new Set<string>(), seenCnic = new Set<string>();
  const out: RowResult[] = rows.map(({ line, raw }) => {
    const errors: string[] = []; let status: RowResult['status'] = 'valid';
    if (!raw.full_name) errors.push('Staff name is required.');
    const phone = normalizePhone(raw.phone!);
    if (!raw.phone) errors.push('Phone is required.'); else if (!/^\d{9,15}$/.test(phone)) errors.push('Phone is not a valid number.');
    const gender = raw.gender ? ({ m: 'male', male: 'male', f: 'female', female: 'female', other: 'other' } as Record<string, string>)[raw.gender.toLowerCase()] : undefined;
    if (raw.gender && !gender) errors.push('Gender must be male, female or other.');
    const cnic = raw.cnic ? normalizeCnic(raw.cnic) : '';
    if (cnic && !/^\d{5}-\d{7}-\d$/.test(cnic)) errors.push('CNIC must be 13 digits.');
    const join = raw.joining_date ? parseDate(raw.joining_date) : null;
    if (raw.joining_date && !join) errors.push('Joining date is not a valid date.');
    const et = raw.employment_type ? raw.employment_type.toLowerCase().replace(/[\s-]/g, '_') : 'permanent';
    if (!['permanent', 'contract', 'part_time', 'visiting'].includes(et)) errors.push('Employment type must be permanent, contract, part-time or visiting.');
    const code = raw.employee_code.toUpperCase();
    if (code) { if (existing.codes.has(code) || seen.has(code)) { errors.push('Employee ID already exists.'); status = 'duplicate'; } seen.add(code); }
    if (cnic) { if (existing.cnics.has(cnic) || seenCnic.has(cnic)) { errors.push('A staff member with this CNIC already exists.'); status = 'duplicate'; } seenCnic.add(cnic); }
    if (errors.length && status === 'valid') status = 'invalid';
    return { line, raw, status, errors, data: status === 'valid' ? { full_name: raw.full_name, gender, cnic: cnic || undefined, phone, email: raw.email || undefined, designation: raw.designation || undefined, department: raw.department || undefined, joining_date: join ?? undefined, qualification: raw.qualification || undefined, employment_type: et, employee_code: code || undefined } : undefined };
  });
  return { headerErrors, unknownHeaders, rows: out, counts: summarise(out) };
}

// ───────────────────────── marks ─────────────────────────
export const MARKS_COLS: ColSpec[] = [
  { key: 'student_code', label: 'Student ID', required: true, example: 'STD-0001', aliases: ['student code', 'id'] },
  { key: 'marks', label: 'Marks', example: '78' },
  { key: 'absent', label: 'Absent', example: 'no', aliases: ['abs'] },
  { key: 'remarks', label: 'Remarks', example: '' },
];
export function validateMarks(csv: string, ctx: { max: number; students: Map<string, string> }): Report {
  const { rows, headerErrors, unknownHeaders } = readTable(csv, MARKS_COLS);
  const seen = new Set<string>();
  const out: RowResult[] = rows.map(({ line, raw }) => {
    const errors: string[] = []; let status: RowResult['status'] = 'valid';
    const code = raw.student_code!.toUpperCase();
    const id = ctx.students.get(code);
    if (!code) errors.push('Student ID is required.'); else if (!id) errors.push(`Student "${code}" is not in this class.`);
    if (seen.has(code)) { errors.push('Student appears twice in the file.'); status = 'duplicate'; } seen.add(code);
    const absent = /^(y|yes|true|1|abs|absent)$/i.test(raw.absent!);
    let marks: number | undefined;
    if (!absent) {
      if (raw.marks === '') errors.push('Enter marks, or mark the student absent.');
      else { marks = Number(raw.marks); if (!Number.isFinite(marks) || marks < 0) errors.push('Marks must be a number.'); else if (marks > ctx.max) errors.push(`Marks exceed the maximum of ${ctx.max}.`); }
    }
    if (errors.length && status === 'valid') status = 'invalid';
    return { line, raw, status, errors, data: status === 'valid' ? { student_id: id, marks, absent, remarks: raw.remarks || undefined } : undefined };
  });
  return { headerErrors, unknownHeaders, rows: out, counts: summarise(out) };
}

// ───────────────────────── fee structure ─────────────────────────
export const FEE_COLS: ColSpec[] = [
  { key: 'class', label: 'Class', example: 'Class 3', aliases: ['class name'] },
  { key: 'category', label: 'Fee category code', required: true, example: 'TUITION', aliases: ['category', 'fee category'] },
  { key: 'amount', label: 'Amount', required: true, example: '4500' },
  { key: 'frequency', label: 'Frequency', example: 'monthly' },
];
export function validateFees(csv: string, lk: { classes: Map<string, string>; categories: Map<string, string> }): Report {
  const { rows, headerErrors, unknownHeaders } = readTable(csv, FEE_COLS);
  const seen = new Set<string>();
  const out: RowResult[] = rows.map(({ line, raw }) => {
    const errors: string[] = []; let status: RowResult['status'] = 'valid';
    const all = raw.class === '' || raw.class === '*' || /^all/i.test(raw.class!);
    const classId = all ? null : lk.classes.get(raw.class!.toLowerCase());
    if (!all && !classId) errors.push(`Class "${raw.class}" does not exist in this campus.`);
    const catId = lk.categories.get(raw.category!.toLowerCase());
    if (!catId) errors.push(`Fee category "${raw.category}" does not exist.`);
    const amount = Number(raw.amount);
    if (raw.amount === '' || !Number.isFinite(amount) || amount < 0) errors.push('Amount must be a number, zero or more.');
    const freq = (raw.frequency || 'monthly').toLowerCase();
    if (!['monthly', 'once', 'annual', 'termly'].includes(freq)) errors.push('Frequency must be monthly, once, annual or termly.');
    const key = `${classId ?? '*'}|${catId}`;
    if (seen.has(key)) { errors.push('This class and category appear twice in the file.'); status = 'duplicate'; } seen.add(key);
    if (errors.length && status === 'valid') status = 'invalid';
    return { line, raw, status, errors, data: status === 'valid' ? { class_id: classId, fee_category_id: catId, amount, frequency: freq } : undefined };
  });
  return { headerErrors, unknownHeaders, rows: out, counts: summarise(out) };
}
