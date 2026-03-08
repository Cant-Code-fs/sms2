import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { calculateLateFee, getApplicableMonths } from '@/lib/utils/calculateLateFee';
import { getCurrentIST } from '@/lib/utils/formatDate';
import type { StudentDues } from '@/types';

export async function GET(
    _req: NextRequest,
    { params }: { params: { schoolId: string; studentId: string } }
) {
    try {
        const supabase = createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { schoolId, studentId } = params;
        const today = getCurrentIST();

        // Fetch student with all related data
        const student = await prisma.student.findFirst({
            where: { id: studentId, school_id: schoolId },
            include: {
                section: { include: { class: true } },
                transport_enrollment: { include: { route: true } },
                receipts: {
                    where: { is_cancelled: false },
                    select: { fee_breakdown: true },
                },
                one_time_fee_records: {
                    where: { is_paid: false },
                    include: {
                        annual_charge_term: true,
                        exam_term: true,
                    },
                },
            },
        });

        if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

        const school = await prisma.school.findUnique({
            where: { id: schoolId },
            select: { current_academic_year: true },
        });
        const academicYear = school?.current_academic_year || '2024-25';

        // Get fee structures for student's class
        const feeStructures = await prisma.feeStructure.findMany({
            where: {
                school_id: schoolId,
                class_id: student.section.class_id,
                academic_year: academicYear,
                is_active: true,
                fee_type: { fee_category: { in: ['monthly'] } },
            },
            include: { fee_type: true },
        });

        // Build set of already paid months from receipts
        const paidMonthlyMap = new Map<string, Set<string>>(); // feeTypeId -> Set of months
        for (const receipt of student.receipts) {
            const bd = receipt.fee_breakdown as {
                monthly?: Array<{ feeTypeId: string; month: string }>;
                transport?: Array<{ month: string }>;
            };
            (bd.monthly || []).forEach(({ feeTypeId, month }) => {
                if (!paidMonthlyMap.has(feeTypeId)) paidMonthlyMap.set(feeTypeId, new Set());
                paidMonthlyMap.get(feeTypeId)!.add(month);
            });
        }

        // Paid transport months
        const paidTransportMonths = new Set<string>();
        for (const receipt of student.receipts) {
            const bd = receipt.fee_breakdown as { transport?: Array<{ month: string }> };
            (bd.transport || []).forEach(({ month }) => paidTransportMonths.add(month));
        }

        // ─── Monthly Fees ───────────────────────────────────────────
        // Enforce sequential payment: for each fee type, show only the
        // FIRST unpaid month. The next month unlocks only after the
        // previous one is paid.
        const applicableMonths = getApplicableMonths(academicYear, student.admission_date, today);
        const monthlyDues: StudentDues['monthly'] = [];

        for (const fs of feeStructures) {
            const paidForType = paidMonthlyMap.get(fs.fee_type_id) || new Set();
            // Find the first month that hasn't been paid yet
            const firstUnpaidMonth = applicableMonths.find((month) => !paidForType.has(month));
            if (!firstUnpaidMonth) continue; // All months paid for this fee type
            const lateFine = calculateLateFee(firstUnpaidMonth, today, fs.fee_type.has_late_fine);
            monthlyDues.push({
                feeTypeId: fs.fee_type_id,
                feeTypeName: fs.fee_type.name,
                month: firstUnpaidMonth,
                amount: Number(fs.amount),
                lateFine,
                selected: true,
            });
        }

        // ─── Transport Fees ─────────────────────────────────────────
        const transportDues: StudentDues['transport'] = [];
        if (student.transport_enrollment?.is_active) {
            const route = student.transport_enrollment.route;
            const transportMonths = getApplicableMonths(academicYear, student.transport_enrollment.start_date, today);
            for (const month of transportMonths) {
                if (paidTransportMonths.has(month)) continue;
                const lateFine = calculateLateFee(month, today, true);
                transportDues.push({
                    routeId: route.id,
                    routeName: route.route_name,
                    month,
                    amount: Number(route.monthly_fee),
                    lateFine,
                    selected: true,
                });
            }
        }

        // ─── Exam / Annual / One-Time from OneTimeFeeRecord ─────────
        const examDues: StudentDues['examination'] = [];
        const annualDues: StudentDues['annual'] = [];
        const oneTimeDues: StudentDues['oneTime'] = [];

        for (const record of student.one_time_fee_records) {
            const feeType = await prisma.feeType.findUnique({ where: { id: record.fee_type_id } });
            if (!feeType) continue;

            if (feeType.fee_category === 'examination' && record.exam_term) {
                const lateFine = calculateLateFee(
                    record.exam_term.due_date.toISOString(),
                    today,
                    feeType.has_late_fine
                );
                examDues.push({
                    feeTypeId: feeType.id,
                    feeTypeName: feeType.name,
                    examTermId: record.exam_term.id,
                    termName: record.exam_term.name,
                    amount: Number(record.amount),
                    lateFine,
                    oneTimeFeeRecordId: record.id,
                    selected: true,
                });
            } else if (feeType.fee_category === 'annual' && record.annual_charge_term) {
                annualDues.push({
                    feeTypeId: feeType.id,
                    feeTypeName: feeType.name,
                    termId: record.annual_charge_term.id,
                    termName: record.annual_charge_term.name,
                    amount: Number(record.amount),
                    oneTimeFeeRecordId: record.id,
                    selected: true,
                });
            } else if (feeType.fee_category === 'one_time' && record.annual_charge_term) {
                oneTimeDues.push({
                    feeTypeId: feeType.id,
                    feeTypeName: feeType.name,
                    termId: record.annual_charge_term.id,
                    termName: record.annual_charge_term.name,
                    amount: Number(record.amount),
                    oneTimeFeeRecordId: record.id,
                    selected: true,
                });
            }
        }

        const dues: StudentDues = {
            studentId,
            monthly: monthlyDues,
            transport: transportDues,
            examination: examDues,
            annual: annualDues,
            oneTime: oneTimeDues,
        };

        return NextResponse.json({ success: true, data: dues });
    } catch (error) {
        console.error('Student dues error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
