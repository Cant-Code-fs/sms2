import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

export async function GET(
    _req: NextRequest,
    { params }: { params: { schoolId: string } }
) {
    try {
        const supabase = createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const fee_types = await prisma.feeType.findMany({
            where: { school_id: params.schoolId },
            orderBy: { name: 'asc' },
        });
        return NextResponse.json({ success: true, data: fee_types });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { schoolId: string } }
) {
    try {
        const supabase = createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { name, fee_category, description, has_late_fine } = body;

        // Annual and one_time always have no late fine
        const finalHasLateFine = ['annual', 'one_time'].includes(fee_category) ? false : has_late_fine;

        const feeType = await prisma.feeType.create({
            data: { school_id: params.schoolId, name, fee_category, description: description || null, has_late_fine: finalHasLateFine, is_active: true },
        });

        return NextResponse.json({ success: true, data: feeType }, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
