import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// GET /api/receipts/[receiptId]/pdf — redirect to PDF URL or generate
export async function GET(
    _req: NextRequest,
    { params }: { params: { receiptId: string } }
) {
    try {
        const supabase = createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const receipt = await prisma.receipt.findUnique({
            where: { id: params.receiptId },
            include: {
                school: true,
                student: { include: { section: { include: { class: true } } } },
            },
        });

        if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });

        // If PDF URL exists in storage, redirect
        if (receipt.pdf_url) {
            return NextResponse.redirect(receipt.pdf_url);
        }

        // Return receipt data for client-side PDF generation
        return NextResponse.json({ success: true, data: receipt });
    } catch (error) {
        console.error('Receipt PDF error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
