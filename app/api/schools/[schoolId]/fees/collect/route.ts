import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import { generateReceiptNumber } from '@/lib/utils/generateReceiptNumber';
import type { FeeBreakdown } from '@/types';

export async function POST(
    request: NextRequest,
    { params }: { params: { schoolId: string } }
) {
    try {
        const supabase = createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Get staff profile
        const staff = await prisma.staff.findUnique({
            where: { supabase_uid: session.user.id },
            select: { id: true, name: true, role: true, school_id: true, is_active: true },
        });
        if (!staff || !staff.is_active) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const { schoolId } = params;
        const body = await request.json();

        const {
            studentId,
            selectedMonthly,
            selectedTransport,
            selectedExam,
            selectedAnnual,
            selectedOneTime,
            concession,
            concessionReason,
            paymentMode,
            chequeNumber,
            upiTxnId,
            paymentDate,
            notes,
            totalAmount,
            lateFineTotal,
        } = body;

        if (totalAmount <= 0) {
            return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
        }

        // Verify student belongs to this school
        const student = await prisma.student.findFirst({
            where: { id: studentId, school_id: schoolId, is_active: true },
        });
        if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

        // Build fee breakdown
        const feeBreakdown: FeeBreakdown = {
            monthly: (selectedMonthly || []).map((m: Record<string, unknown>) => ({
                feeTypeId: m.feeTypeId as string,
                feeTypeName: m.feeTypeName as string,
                month: m.month as string,
                amount: m.amount as number,
                lateFine: m.lateFine as number,
            })),
            transport: (selectedTransport || []).map((t: Record<string, unknown>) => ({
                routeName: t.routeName as string,
                month: t.month as string,
                amount: t.amount as number,
                lateFine: t.lateFine as number,
            })),
            examination: (selectedExam || []).map((e: Record<string, unknown>) => ({
                feeTypeId: e.feeTypeId as string,
                feeTypeName: e.feeTypeName as string,
                examTermId: e.examTermId as string,
                termName: e.termName as string,
                amount: e.amount as number,
            })),
            annual: (selectedAnnual || []).map((a: Record<string, unknown>) => ({
                feeTypeId: a.feeTypeId as string,
                feeTypeName: a.feeTypeName as string,
                termId: a.termId as string,
                termName: a.termName as string,
                amount: a.amount as number,
            })),
            oneTime: (selectedOneTime || []).map((o: Record<string, unknown>) => ({
                feeTypeId: o.feeTypeId as string,
                feeTypeName: o.feeTypeName as string,
                termId: o.termId as string,
                termName: o.termName as string,
                amount: o.amount as number,
            })),
        };

        // Execute in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Generate receipt number
            const receiptNumber = await generateReceiptNumber(schoolId);

            // 2. Create receipt
            const receipt = await tx.receipt.create({
                data: {
                    school_id: schoolId,
                    student_id: studentId,
                    receipt_number: receiptNumber,
                    amount: totalAmount,
                    late_fine: lateFineTotal || 0,
                    concession: concession || 0,
                    payment_date: new Date(paymentDate),
                    payment_mode: paymentMode,
                    fee_breakdown: feeBreakdown as object,
                    generated_by: staff.id,
                },
            });

            // 3. Create payment record
            await tx.payment.create({
                data: {
                    student_id: studentId,
                    receipt_id: receipt.id,
                    amount_paid: totalAmount,
                    late_fine_paid: lateFineTotal || 0,
                    concession: concession || 0,
                    concession_reason: concessionReason || null,
                    payment_date: new Date(paymentDate),
                    payment_mode: paymentMode,
                    cheque_number: chequeNumber || null,
                    upi_txn_id: upiTxnId || null,
                    notes: notes || null,
                    collected_by: staff.id,
                    fee_breakdown: feeBreakdown as object,
                },
            });

            // 4. Mark OneTimeFeeRecords as paid
            const oneTimeRecordIds = [
                ...(selectedExam || []).map((e: Record<string, unknown>) => e.oneTimeFeeRecordId as string),
                ...(selectedAnnual || []).map((a: Record<string, unknown>) => a.oneTimeFeeRecordId as string),
                ...(selectedOneTime || []).map((o: Record<string, unknown>) => o.oneTimeFeeRecordId as string),
            ].filter(Boolean);

            if (oneTimeRecordIds.length > 0) {
                await tx.oneTimeFeeRecord.updateMany({
                    where: { id: { in: oneTimeRecordIds } },
                    data: {
                        is_paid: true,
                        payment_id: receipt.id,
                        paid_at: new Date(paymentDate),
                    },
                });
            }

            // 5. Log concession to AuditLog if applicable
            if (concession > 0) {
                await tx.auditLog.create({
                    data: {
                        school_id: schoolId,
                        staff_id: staff.id,
                        action: 'concession_granted',
                        entity_type: 'receipt',
                        entity_id: receipt.id,
                        new_value: { amount: concession, reason: concessionReason, receiptNumber },
                    },
                });
            }

            return { receipt, receiptNumber };
        });

        return NextResponse.json({
            success: true,
            data: {
                receiptId: result.receipt.id,
                receiptNumber: result.receiptNumber,
                amount: totalAmount,
            },
        });
    } catch (error) {
        console.error('Fee collection error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
