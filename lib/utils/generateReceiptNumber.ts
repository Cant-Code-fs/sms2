import prisma from '@/lib/prisma';

/**
 * Generates a unique, sequential receipt number per school.
 * Format: {prefix}-{YY-YY}-{000001}
 * e.g. SCH1-2425-000123
 *
 * Uses a DB-level counter on the School.receipt_counter column,
 * incremented atomically per transaction.
 */
export async function generateReceiptNumber(schoolId: string): Promise<string> {
    const school = await prisma.school.update({
        where: { id: schoolId },
        data: { receipt_counter: { increment: 1 } },
        select: { receipt_prefix: true, receipt_counter: true, current_academic_year: true },
    });

    // "2024-25" → "2425"
    const yearCode = school.current_academic_year.replace('-', '').replace('20', '');

    const counter = String(school.receipt_counter).padStart(6, '0');

    return `${school.receipt_prefix}-${yearCode}-${counter}`;
}
