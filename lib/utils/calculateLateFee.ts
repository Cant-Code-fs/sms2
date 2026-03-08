/**
 * calculateLateFee.ts
 *
 * Late fine rules:
 * - Monthly/transport fees due on the 20th of each month
 * - Fine: ₹5/day after due date (only on school days, simplified as calendar days)
 * - Maximum fine: ₹200 per month per fee type
 * - No fine for fees marked has_late_fine = false (annual, one_time)
 */

const FINE_PER_DAY = 5;
const MAX_FINE_PER_MONTH = 200;

/** Returns the due date for a given month string e.g. "April 2024" → 20th April 2024 */
function getDueDateForMonth(monthStr: string): Date {
    const date = new Date(`${monthStr} 20`);
    return date;
}

/**
 * Calculate late fine for a given month or due date string.
 * If dueDate is an ISO string (for exam terms), use it directly.
 */
export function calculateLateFee(
    monthOrDueDate: string,
    today: Date,
    hasLateFine: boolean,
): number {
    if (!hasLateFine) return 0;

    let dueDate: Date;

    // If it looks like an ISO date (exam term due_date)
    if (monthOrDueDate.includes('T') || monthOrDueDate.includes('-')) {
        dueDate = new Date(monthOrDueDate);
    } else {
        // Month string like "April 2024"
        dueDate = getDueDateForMonth(monthOrDueDate);
    }

    if (today <= dueDate) return 0;

    const daysLate = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const fine = daysLate * FINE_PER_DAY;

    return Math.min(fine, MAX_FINE_PER_MONTH);
}

/**
 * Returns all months applicable for a student from start of academic year
 * (or admission date, whichever is later) up to the current month.
 *
 * Academic year format: "2026-27" → April 2026 to March 2027
 *
 * Rules:
 * - Never shows future months (beyond current calendar month)
 * - If today is before the academic year starts, shows April (so
 *   fees can be collected at admission time for the upcoming year)
 * - Uses the later of: academic start OR admission date as the start
 */
export function getApplicableMonths(
    academicYear: string,
    admissionDate: Date,
    today: Date,
): string[] {
    const [startYear] = academicYear.split('-');
    const yearNum = parseInt(startYear);

    // Academic year runs April (month index 3) to March (month index 2) next year
    const academicStart = new Date(yearNum, 3, 1);       // 1 April of start year
    const academicEnd = new Date(yearNum + 1, 2, 31);  // 31 March of end year

    // Effective start: whichever is later — academic year start or admission date
    const effectiveStart = admissionDate > academicStart ? admissionDate : academicStart;

    // Effective end cap: current calendar month (never future), but also never beyond
    // the academic year end. If today is BEFORE the academic year starts, still allow
    // April (the first month) so fees can be collected ahead of time.
    const todayMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const academicStartMonth = new Date(yearNum, 3, 1);

    // If today is before the academic year, cap at April (first month of the year)
    const endCap = todayMonthStart < academicStartMonth ? academicStartMonth : todayMonthStart;
    const effectiveEnd = endCap < academicEnd ? endCap : academicEnd;

    const months: string[] = [];
    const current = new Date(effectiveStart.getFullYear(), effectiveStart.getMonth(), 1);
    const end = new Date(effectiveEnd.getFullYear(), effectiveEnd.getMonth(), 1);

    while (current <= end) {
        const monthName = current.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
        months.push(monthName);
        current.setMonth(current.getMonth() + 1);
    }

    return months;
}

/** Returns the month label for a given date e.g. "April 2024" */
export function getMonthLabel(date: Date): string {
    return date.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
}
