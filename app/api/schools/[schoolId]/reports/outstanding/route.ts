import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { calculateLateFee, getApplicableMonths } from '@/lib/utils/calculateLateFee';
import { getCurrentIST } from '@/lib/utils/formatDate';

export async function GET(
    request: NextRequest,
    { params }: { params: { schoolId: string } }
) {
    try {
        const supabase = createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { schoolId } = params;
        const url = new URL(request.url);
        const classId = url.searchParams.get('classId') || '';
        const format = url.searchParams.get('format') || '';
        const today = getCurrentIST();

        const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { current_academic_year: true } });
        const academicYear = school?.current_academic_year || '2024-25';

        // Get all active students
        const students = await prisma.student.findMany({
            where: {
                school_id: schoolId,
                is_active: true,
                ...(classId ? { section: { class_id: classId } } : {}),
            },
            include: {
                section: { include: { class: { include: { fee_structures: { where: { academic_year: academicYear, is_active: true } } } } } },
                transport_enrollment: { include: { route: true } },
                receipts: { where: { is_cancelled: false }, select: { fee_breakdown: true } },
                one_time_fee_records: { where: { is_paid: false }, select: { amount: true } },
            },
            orderBy: [{ section: { class: { order: 'asc' } } }, { first_name: 'asc' }],
        });

        const rows = students.map(student => {
            const applicableMonths = getApplicableMonths(academicYear, student.admission_date, today);

            // Paid months
            const paidMonths = new Set<string>();
            const paidTransportMonths = new Set<string>();
            for (const r of student.receipts) {
                const bd = r.fee_breakdown as { monthly?: Array<{ month: string }>; transport?: Array<{ month: string }> };
                (bd.monthly || []).forEach(m => paidMonths.add(m.month));
                (bd.transport || []).forEach(t => paidTransportMonths.add(t.month));
            }

            const unpaidMonths = applicableMonths.filter(m => !paidMonths.has(m));
            const monthlyFeePerMonth = Number(student.section.class.fee_structures[0]?.amount || 0);
            const monthlyDues = unpaidMonths.length * monthlyFeePerMonth;

            // Transport
            let transportDues = 0;
            if (student.transport_enrollment?.is_active) {
                const route = student.transport_enrollment.route;
                const tMonths = getApplicableMonths(academicYear, student.transport_enrollment.start_date, today);
                const unpaidTMonths = tMonths.filter(m => !paidTransportMonths.has(m));
                transportDues = unpaidTMonths.length * Number(route.monthly_fee);
            }

            // Exam/annual dues from OneTimeFeeRecord
            const oneTimeDues = student.one_time_fee_records.reduce((s, r) => s + Number(r.amount), 0);

            const totalOutstanding = monthlyDues + transportDues + oneTimeDues;
            if (totalOutstanding <= 0) return null;

            return {
                id: student.id,
                studentName: `${student.first_name} ${student.last_name}`,
                admissionNo: student.admission_no,
                className: student.section.class.name,
                sectionName: student.section.name,
                parentPhone: student.parent_phone,
                monthlyDues,
                transportDues,
                examDues: 0, // Would need separate calculation per fee type
                annualDues: oneTimeDues,
                totalOutstanding,
            };
        }).filter(Boolean).sort((a, b) => (b?.totalOutstanding || 0) - (a?.totalOutstanding || 0));

        if (format === 'csv') {
            const headers = ['Admission No', 'Student Name', 'Class', 'Monthly Dues', 'Transport Dues', 'Annual Dues', 'Total Outstanding', 'Parent Phone'];
            const csvRows = [
                headers,
                ...rows.map(r => [r!.admissionNo, r!.studentName, `${r!.className}-${r!.sectionName}`, r!.monthlyDues, r!.transportDues, r!.annualDues, r!.totalOutstanding, r!.parentPhone]),
            ];
            const csv = csvRows.map(row => row.map(v => `"${v}"`).join(',')).join('\n');
            return new NextResponse(csv, {
                headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="outstanding.csv"' },
            });
        }

        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        console.error('Outstanding report error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
