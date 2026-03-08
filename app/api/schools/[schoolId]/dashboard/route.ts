import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import type { ApiResponse } from '@/types';

export async function GET(
    _req: NextRequest,
    { params }: { params: { schoolId: string } }
) {
    try {
        const supabase = createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { schoolId } = params;

        const school = await prisma.school.findUnique({
            where: { id: schoolId },
            select: { id: true, name: true, receipt_prefix: true, current_academic_year: true },
        });

        if (!school) return NextResponse.json({ error: 'School not found' }, { status: 404 });

        // Stats
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const [totalStudents, monthReceipts, todayReceipts, classData, monthlyTrend, categoryData, modeData, recentPayments] = await Promise.all([
            prisma.student.count({ where: { school_id: schoolId, is_active: true } }),
            prisma.receipt.findMany({
                where: { school_id: schoolId, is_cancelled: false, payment_date: { gte: monthStart } },
                select: { amount: true, late_fine: true },
            }),
            prisma.receipt.findMany({
                where: { school_id: schoolId, is_cancelled: false, payment_date: { gte: todayStart } },
                select: { amount: true },
            }),
            prisma.class.findMany({
                where: { school_id: schoolId },
                include: { sections: { include: { students: { where: { is_active: true } } } }, fee_structures: { where: { academic_year: school.current_academic_year, is_active: true } } },
                orderBy: { order: 'asc' },
            }),
            // Last 6 months trend
            prisma.$queryRaw<Array<{ month: string; total: number }>>`
        SELECT TO_CHAR(payment_date, 'Mon YYYY') as month, SUM(amount::numeric) as total
        FROM "Receipt"
        WHERE school_id = ${schoolId} AND is_cancelled = false
          AND payment_date >= NOW() - INTERVAL '6 months'
        GROUP BY TO_CHAR(payment_date, 'Mon YYYY'), DATE_TRUNC('month', payment_date)
        ORDER BY DATE_TRUNC('month', payment_date)
      `,
            // Category breakdown from fee_breakdown JSON
            prisma.receipt.findMany({
                where: { school_id: schoolId, is_cancelled: false, payment_date: { gte: monthStart } },
                select: { fee_breakdown: true },
            }),
            // Mode breakdown
            prisma.receipt.groupBy({
                by: ['payment_mode'],
                where: { school_id: schoolId, is_cancelled: false, payment_date: { gte: monthStart } },
                _sum: { amount: true },
            }),
            // Recent payments
            prisma.receipt.findMany({
                where: { school_id: schoolId, is_cancelled: false },
                orderBy: { payment_date: 'desc' },
                take: 10,
                include: {
                    student: { include: { section: { include: { class: true } } } },
                },
            }),
        ]);

        const thisMonthCollection = monthReceipts.reduce((s, r) => s + Number(r.amount), 0);
        const lateFinesCollected = monthReceipts.reduce((s, r) => s + Number(r.late_fine), 0);
        const todayCollection = todayReceipts.reduce((s, r) => s + Number(r.amount), 0);

        // Class progress
        const classProgress = classData.map((cls) => {
            const studentCount = cls.sections.reduce((s, sec) => s + sec.students.length, 0);
            const monthlyFeeStructure = cls.fee_structures.find((fs) => true);
            const expected = studentCount * (monthlyFeeStructure ? Number(monthlyFeeStructure.amount) : 0);
            return {
                classId: cls.id,
                className: cls.name,
                expected,
                collected: 0, // Would need more complex calculation
                percentage: 0,
            };
        });

        // Category breakdown
        let tuitionTotal = 0, transportTotal = 0, examTotal = 0, annualTotal = 0, oneTimeTotal = 0;
        categoryData.forEach((r) => {
            const bd = r.fee_breakdown as Record<string, Array<{ amount: number; lateFine?: number }>>;
            (bd.monthly || []).forEach(m => { tuitionTotal += m.amount + (m.lateFine || 0); });
            (bd.transport || []).forEach(t => { transportTotal += t.amount + (t.lateFine || 0); });
            (bd.examination || []).forEach(e => { examTotal += e.amount; });
            (bd.annual || []).forEach(a => { annualTotal += a.amount; });
            (bd.oneTime || []).forEach(o => { oneTimeTotal += o.amount; });
        });

        return NextResponse.json({
            success: true,
            data: {
                schoolName: school.name,
                academicYear: school.current_academic_year,
                stats: {
                    totalActiveStudents: totalStudents,
                    todayCollection,
                    thisMonthCollection,
                    outstandingThisMonth: 0, // Complex calculation
                    overdueAmount: 0,
                    lateFinesCollected,
                },
                monthlyTrend: monthlyTrend.map(m => ({ month: m.month, amount: Number(m.total) })),
                classProgress,
                categoryBreakdown: [
                    { name: 'Tuition', value: tuitionTotal },
                    { name: 'Transport', value: transportTotal },
                    { name: 'Examination', value: examTotal },
                    { name: 'Annual', value: annualTotal },
                    { name: 'One-Time', value: oneTimeTotal },
                ].filter(c => c.value > 0),
                modeBreakdown: modeData.map(m => ({ name: m.payment_mode.toUpperCase(), value: Number(m._sum.amount || 0) })),
                recentPayments: recentPayments.map(r => ({
                    id: r.id,
                    studentName: `${r.student.first_name} ${r.student.last_name}`,
                    className: `${r.student.section.class.name}-${r.student.section.name}`,
                    amount: Number(r.amount),
                    lateFine: Number(r.late_fine),
                    paymentMode: r.payment_mode,
                    paymentDate: r.payment_date.toISOString(),
                    receiptNumber: r.receipt_number,
                })),
            },
        } satisfies ApiResponse);
    } catch (error) {
        console.error('School dashboard error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
