import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

export async function POST(
    request: NextRequest,
    { params }: { params: { schoolId: string; receiptId: string } }
) {
    try {
        const supabase = createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const staff = await prisma.staff.findUnique({
            where: { supabase_uid: session.user.id },
            select: { id: true, role: true, is_active: true },
        });
        if (!staff || !staff.is_active) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        if (staff.role === 'receptionist') return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

        const { cancel_reason } = await request.json();
        if (!cancel_reason || cancel_reason.length < 5) {
            return NextResponse.json({ error: 'A valid cancellation reason is required' }, { status: 400 });
        }

        const receipt = await prisma.receipt.findFirst({
            where: { id: params.receiptId, school_id: params.schoolId },
        });
        if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
        if (receipt.is_cancelled) return NextResponse.json({ error: 'Receipt already cancelled' }, { status: 409 });

        const now = new Date();

        await prisma.$transaction(async (tx) => {
            // Cancel receipt
            await tx.receipt.update({
                where: { id: params.receiptId },
                data: { is_cancelled: true, cancel_reason, cancelled_by: staff.id, cancelled_at: now },
            });

            // Cancel associated payments
            await tx.payment.updateMany({
                where: { receipt_id: params.receiptId },
                data: { is_cancelled: true, cancel_reason, cancelled_by: staff.id, cancelled_at: now },
            });

            // Audit log
            await tx.auditLog.create({
                data: {
                    school_id: params.schoolId,
                    staff_id: staff.id,
                    action: 'receipt_cancelled',
                    entity_type: 'receipt',
                    entity_id: params.receiptId,
                    old_value: { receipt_number: receipt.receipt_number, amount: Number(receipt.amount) },
                    new_value: { cancel_reason },
                },
            });

            // Note: OneTimeFeeRecords are NOT automatically reversed
        });

        return NextResponse.json({ success: true, message: 'Receipt cancelled' });
    } catch (error) {
        console.error('Cancel receipt error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
