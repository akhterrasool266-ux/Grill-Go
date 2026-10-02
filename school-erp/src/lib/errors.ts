/**
 * Turns database / RPC errors into messages a school clerk can act on.
 * Raw Postgres errors are NEVER shown to users; unknown errors get a reference id
 * that is logged server-side.
 */
export interface DbErrorLike { code?: string; message?: string; details?: string; hint?: string }

const TOKENS: Record<string, string> = {
  not_authenticated: 'Your session has expired. Please sign in again.',
  permission_denied: "You don't have permission to do that.",
  invalid_amount: 'Please enter a valid amount greater than zero.',
  amount_too_large: 'That amount is too large. Please check it.',
  reference_required: 'A reference / transaction number is required for non-cash payments.',
  reason_required: 'Please enter a reason (at least 3 characters).',
  day_closed: 'Today\'s cash register is already closed. Payments can be taken tomorrow.',
  already_closed: 'This day is already closed.',
  cannot_close_future_date: 'You cannot close a day that has not happened yet.',
  no_account_for_method: 'No cash/bank account is set up for this payment method. Add one under Finance → Accounts.',
  refund_exceeds_payment: 'The refund is more than what remains of this payment.',
  discount_exceeds_charges: 'The discount is larger than the amount charged.',
  discount_exceeds_unpaid_balance: 'That discount would reduce the bill below what was already paid. Refund the excess payment first.',
  invoice_has_payments: 'This voucher already has payments. Refund them before cancelling.',
  invoice_cancelled: 'This voucher has been cancelled.',
  no_current_academic_year: 'No current academic year is set. Go to Settings → Academic years and mark one as current.',
  label_required: 'Please give this charge a name, e.g. "Annual Fee 2026-27".',
  categories_required: 'Choose at least one fee category.',
  due_date_required: 'Please choose a due date.',
  student_not_in_section: 'One of the students does not belong to this section.',
  future_date: 'Attendance cannot be marked for a future date.',
  correction_requires_edit_permission_and_reason: 'Changing an attendance mark that already exists needs the correction permission and a reason.',
  backdated_requires_edit_permission_and_reason: 'Marking attendance for a past date needs the correction permission and a reason.',
  student_not_found: 'Student not found. Check the ID and try again.',
  staff_not_found: 'Staff member not found.',
  not_checked_in: 'You have not checked in today.',
  invalid_transition: 'That step is not allowed from the current admission stage.',
  documents_not_verified: 'Verify the applicant\'s documents before moving on.',
  test_or_interview_required: 'Schedule an admission test or interview first.',
  not_ready: 'This application must be in the Approval stage before the student can be admitted.',
  class_required: 'Choose the class the applicant is applying to.',
  section_does_not_match_class: 'That section does not belong to the applicant\'s class.',
  exam_not_scheduled: 'Schedule the exam before entering marks.',
  marks_exceed_max: 'Marks cannot be higher than the maximum marks for the subject.',
  marks_locked: 'Marks are locked for this exam. Reopen it (with a reason) to make changes.',
  student_not_in_class: 'One of the students is not in this class.',
  already_published: 'Results are already published. Reopen the exam to change them.',
  incomplete_results: 'Some students still have missing marks. Complete marks entry first.',
  no_results: 'Generate the results first.',
  no_grading_system: 'No grading system is configured. Add one under Settings → Exams.',
  target_year_must_be_later: 'The target academic year must be after the current one.',
  target_year_not_found: 'Target academic year not found.',
  already_promoted: 'This student has already been promoted for the current year.',
  conditions_required: 'Please state the conditions for a conditional promotion.',
  no_next_class: 'No next class is set for one of the students\' classes. Set it under Academics → Classes.',
  payroll_already_approved: 'This month\'s payroll is already approved and cannot be regenerated.',
  payroll_not_draft: 'Only draft payroll can be approved.',
  payroll_not_approved: 'Approve the payroll before paying it.',
  account_not_found: 'Choose a valid cash/bank account.',
  cannot_approve_own_leave: 'You cannot approve your own leave.',
  insufficient_leave_balance: 'Not enough leave balance for this request.',
  leave_not_pending: 'This request has already been decided.',
  cannot_approve_own_expense: 'You cannot approve an expense you raised yourself.',
  expense_not_pending: 'This expense has already been decided.',
  expense_not_approved: 'Approve the expense before paying it.',
  expense_locked: 'Approved expenses cannot be edited.',
  journal_unbalanced: 'Debits and credits do not match.',
  journal_needs_two_lines: 'A journal entry needs at least two lines.',
  no_copies_available: 'No copies of this book are available right now.',
  borrower_has_overdue_books: 'This borrower has overdue books. They must be returned first.',
  renewal_limit_reached: 'This book cannot be renewed again.',
  overdue_cannot_renew: 'Overdue books cannot be renewed. Return it first.',
  already_returned: 'This book has already been returned.',
  plan_limit_reached: 'Your subscription plan limit has been reached. Upgrade your plan to add more.',
  break_period: 'Lessons cannot be scheduled during a break.',
  campus_immutable: 'A student cannot be moved to another campus. Create a transfer admission instead.',
  year_not_found: 'Academic year not found.',
  full_name_required: "Please enter the student's name.",
  guardian_name_required: "Please enter the parent / guardian's name.",
  invalid_gender: 'Please choose a gender.',
  family_not_found: 'No family found with that code.',
  class_not_in_campus: 'That class does not belong to this campus.',
  duplicate_key: 'This record already exists.',
  invalid_status: 'Invalid status.',
  no_rows: 'Nothing to save.',
};

/** Constraint / index name fragment → message. First match wins. */
const CONSTRAINTS: [RegExp, string][] = [
  [/students_school_id_admission_no/, 'Student admission number already exists.'],
  [/students_school_id_student_code/, 'That student ID is already in use.'],
  [/timetable_teacher_slot/, 'Teacher already has another class assigned during this period.'],
  [/timetable_section_slot/, 'This class already has a lesson in that period.'],
  [/timetable_room_slot/, 'That room is already booked during this period.'],
  [/fee_invoices_monthly_once/, 'A fee voucher for this student and month already exists.'],
  [/fee_invoices_adhoc_once/, 'A voucher with this name already exists for this student.'],
  [/fee_structures_unique/, 'A fee amount for this category and class already exists. Edit it instead.'],
  [/staff_school_id_employee_code/, 'Employee ID already exists.'],
  [/staff_cnic|guardians_cnic|cnic_check/, 'CNIC must look like 35202-1234567-1.'],
  [/b_form_no_check/, 'B-Form number must look like 35202-1234567-1.'],
  [/subjects_school_id_code/, 'A subject with this code already exists.'],
  [/classes_campus_id_name/, 'A class with this name already exists in this campus.'],
  [/sections_class_id_name/, 'This section already exists in the class.'],
  [/academic_years_school_id_name/, 'An academic year with this name already exists.'],
  [/academic_years_one_current/, 'Only one academic year can be current.'],
  [/grade_bands.*excl/, 'Grade percentage ranges overlap. Adjust the ranges.'],
  [/grade_bands_grading_system_id_grade/, 'This grade already exists in the grading system.'],
  [/exam_subjects_exam_id_class_id_subject_id/, 'This subject is already scheduled for this class in the exam.'],
  [/library_books_isbn/, 'A book with this ISBN already exists.'],
  [/hostel_bed_active/, 'That bed is already occupied.'],
  [/hostel_student_active/, 'This student already has a hostel bed.'],
  [/student_transport_one_active/, 'This student is already assigned to a transport route.'],
  [/teacher_assignments/, 'This teacher assignment already exists.'],
  [/payments_gateway_txn/, 'This online payment was already recorded.'],
  [/campuses_school_id_code/, 'A campus with this code already exists.'],
  [/student_guardians_one_primary/, 'This student already has a primary guardian.'],
  [/leave_balances|leave_types_school_id_name/, 'This leave type already exists.'],
  [/profiles_pkey|users_email/, 'A user with this email already exists.'],
];

export function friendlyError(e: unknown, ref?: string): string {
  const err = (e ?? {}) as DbErrorLike;
  const msg = String(err.message ?? '');
  const text = `${msg} ${err.details ?? ''}`;

  // 1) our own RPC exceptions: "token" or "token: detail"
  const m = /^([a-z_]+)(?::\s*(.*))?$/.exec(msg.trim());
  if (m && TOKENS[m[1]!]) {
    const base = TOKENS[m[1]!]!;
    return m[1] === 'insufficient_leave_balance' && m[2] ? `${base} (${m[2]})` : base;
  }
  if (err.code === 'P0402') return TOKENS.plan_limit_reached!;
  // 2) row-level security / privileges
  if (err.code === '42501' || /row-level security|permission denied/i.test(msg)) return TOKENS.permission_denied!;
  // 3) constraints
  if (err.code === '23505') {
    for (const [re, out] of CONSTRAINTS) if (re.test(text)) return out;
    return 'This record already exists.';
  }
  if (err.code === '23503') return 'This record is still used elsewhere, or refers to something that no longer exists.';
  if (err.code === '23514' || err.code === '23P01') {
    for (const [re, out] of CONSTRAINTS) if (re.test(text)) return out;
    return 'Some of the values are not allowed. Please check the form.';
  }
  if (err.code === '23502') return 'A required field is missing.';
  if (err.code === '22P02' || err.code === '22007') return 'One of the values has the wrong format.';
  for (const [re, out] of CONSTRAINTS) if (re.test(text)) return out;
  if (ref) console.error(`[error ${ref}]`, e);
  return `Something went wrong on our side${ref ? ` (ref ${ref})` : ''}. Please try again.`;
}

export const newRef = () => Math.random().toString(36).slice(2, 8).toUpperCase();
