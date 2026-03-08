import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendDueReminder, sendOverdueReminder, wasRecentlySent } from '@/lib/whatsapp/watiClient';
import { calculateLateFee, getApplicableMonths } from '@/lib/utils/calculateLateFee';
import { getCurrentIST, formatCurrency as _fc } from '@/lib/utils/formatDate';
import { formatCurrency } from '@/lib/utils/formatCurrency';

export async function GET(request: NextRequest) {
    // Verify cron secret
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = getCurrentIST();
    let sent = 0, failed = 0;
    const errors: string[] = [];

    try {
        // Get all active schools
        const schools = await prisma.school.findMany({
            select: { id: true, name: true, phone: true, current_academic_year: true },
        });

        for (const school of schools) {
            // Get all active students
            const students = await prisma.student.findMany({
                where: { school_id: school.id, is_active: true },
                include: {
                    section: { include: { class: { include: { fee_structures: { where: { academic_year: school.current_academic_year, is_active: true } } } } } },
                    transport_enrollment: { include: { route: true } },
                    receipts: { where: { is_cancelled: false }, select: { fee_breakdown: true } },
                    one_time_fee_records: { where: { is_paid: false }, include: { exam_term: true } },
                },
            });

            for (const student of students) {
                const applicableMonths = getApplicableMonths(school.current_academic_year, student.admission_date, today);

                // Build paid months set
                const paidMonths = new Set<string>();
                for (const r of student.receipts) {
                    const bd = r.fee_breakdown as { monthly?: Array<{ month: string }> };
                    (bd.monthly || []).forEach(m => paidMonths.add(m.month));
                }

                const unpaidMonths = applicableMonths.filter(m => !paidMonths.has(m));

                // Check if any month is due in next 3 days
                const dueSoonMonths = unpaidMonths.filter(month => {
                    const [mn, yr] = month.split(' ');
                    const monthIndex = new Date(`${mn} 1, ${yr}`).getMonth();
                    const dueDate = new Date(parseInt(yr), monthIndex, 20);
                    const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    return daysUntilDue >= 0 && daysUntilDue <= 3;
                });

                // Check overdue months (past due date)
                const overdueMonths = unpaidMonths.filter(month => {
                    const [mn, yr] = month.split(' ');
                    const monthIndex = new Date(`${mn} 1, ${yr}`).getMonth();
                    const dueDate = new Date(parseInt(yr), monthIndex, 20);
                    return today > dueDate;
                });

                // Exam fees due in next 5 days
                const examDueSoon = student.one_time_fee_records.filter(r => {
                    if (!r.exam_term) return false;
                    const daysUntilDue = Math.floor((r.exam_term.due_date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    return daysUntilDue >= 0 && daysUntilDue <= 5;
                });

                // Send due reminder
                if ((dueSoonMonths.length > 0 || examDueSoon.length > 0) && !(await wasRecentlySent(student.id, 'fee_due_reminder', 3))) {
                    const amount = unpaidMonths.length * (Number(student.section.class.fee_structures[0]?.amount) || 0);
                    const result = await sendDueReminder(
                        student.id,
                        student.parent_name,
                        `${student.first_name} ${student.last_name}`,
                        student.section.class.name,
                        school.name,
                        formatCurrency(amount),
                        dueSoonMonths.join(', '),
                        '20th of this month',
                        school.phone,
                        student.parent_phone,
                    );
                    if (result.success) sent++; else { failed++; errors.push(student.parent_phone); }
                }

                // Send overdue reminder
                if (overdueMonths.length > 0 && !(await wasRecentlySent(student.id, 'fee_overdue_reminder', 3))) {
                    const totalDue = overdueMonths.reduce((s, month) => {
                        const base = Number(student.section.class.fee_structures[0]?.amount) || 0;
                        const fine = calculateLateFee(month, today, true);
                        return s + base + fine;
                    }, 0);

                    const result = await sendOverdueReminder(
                        student.id,
                        student.parent_name,
                        `${student.first_name} ${student.last_name}`,
                        formatCurrency(totalDue),
                        school.name,
                        school.phone,
                        student.parent_phone,
                    );
                    if (result.success) sent++; else { failed++; errors.push(student.parent_phone); }
                }
            }
        }

        return NextResponse.json({
            success: true,
            sent,
            failed,
            errors: errors.slice(0, 10),
            timestamp: today.toISOString(),
        });
    } catch (error) {
        console.error('Cron reminder error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
