import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

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
        const search = url.searchParams.get('search') || '';
        const paymentMode = url.searchParams.get('paymentMode') || '';
        const dateFrom = url.searchParams.get('dateFrom') || '';
        const dateTo = url.searchParams.get('dateTo') || '';
        const showCancelled = url.searchParams.get('showCancelled') === 'true';
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('pageSize') || '25');

        const where: Record<string, unknown> = { school_id: schoolId };

        if (!showCancelled) where.is_cancelled = false;

        if (paymentMode) where.payment_mode = paymentMode;

        if (dateFrom || dateTo) {
            where.payment_date = {};
            if (dateFrom) (where.payment_date as Record<string, Date>).gte = new Date(dateFrom);
            if (dateTo) {
                const end = new Date(dateTo);
                end.setHours(23, 59, 59, 999);
                (where.payment_date as Record<string, Date>).lte = end;
            }
        }

        if (search) {
            where.OR = [
                { receipt_number: { contains: search, mode: 'insensitive' } },
                { student: { first_name: { contains: search, mode: 'insensitive' } } },
                { student: { last_name: { contains: search, mode: 'insensitive' } } },
                { student: { admission_no: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const [total, receipts] = await Promise.all([
            prisma.receipt.count({ where: where as Parameters<typeof prisma.receipt.count>[0]['where'] }),
            prisma.receipt.findMany({
                where: where as Parameters<typeof prisma.receipt.findMany>[0]['where'],
                include: {
                    student: { include: { section: { include: { class: true } } } },
                },
                orderBy: { payment_date: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);

        return NextResponse.json({
            success: true,
            data: receipts.map(r => ({
                ...r,
                amount: Number(r.amount),
                late_fine: Number(r.late_fine),
                concession: Number(r.concession),
                payment_date: r.payment_date.toISOString(),
            })),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        });
    } catch (error) {
        console.error('Receipts list error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
