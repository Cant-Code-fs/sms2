import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sendPaymentConfirmation } from '@/lib/whatsapp/watiClient';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatDate } from '@/lib/utils/formatDate';

export async function POST(
    request: NextRequest,
    { params }: { params: { schoolId: string } }
) {
    try {
        const supabase = createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { receiptId, studentId } = await request.json();

        const receipt = await prisma.receipt.findUnique({
            where: { id: receiptId },
            include: {
                student: true,
                school: true,
            },
        });

        if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });

        const result = await sendPaymentConfirmation(
            studentId,
            receipt.student.parent_name,
            formatCurrency(Number(receipt.amount)),
            `${receipt.student.first_name} ${receipt.student.last_name}`,
            formatDate(receipt.payment_date),
            receipt.receipt_number,
            receipt.school.name,
            receipt.student.parent_phone,
        );

        return NextResponse.json({ success: result.success, error: result.error });
    } catch (error) {
        console.error('WhatsApp confirmation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
