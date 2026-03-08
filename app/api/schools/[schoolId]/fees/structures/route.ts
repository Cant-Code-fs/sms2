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

        const academicYear = new URL(request.url).searchParams.get('academicYear') || '2024-25';

        const structures = await prisma.feeStructure.findMany({
            where: { school_id: params.schoolId, academic_year: academicYear },
            include: { fee_type: true, class: true },
            orderBy: [{ fee_type: { name: 'asc' } }, { class: { order: 'asc' } }],
        });

        return NextResponse.json({
            success: true,
            data: structures.map(s => ({ ...s, amount: Number(s.amount) })),
        });
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

        const { fee_type_id, class_id, amount, academic_year } = await request.json();

        const structure = await prisma.feeStructure.create({
            data: { school_id: params.schoolId, fee_type_id, class_id, amount, academic_year, is_active: true },
            include: { fee_type: true, class: true },
        });

        return NextResponse.json({ success: true, data: { ...structure, amount: Number(structure.amount) } }, { status: 201 });
    } catch (error) {
        console.error(error);
        if (error instanceof Error && error.message.includes('Unique')) {
            return NextResponse.json({ error: 'Fee structure already exists for this class and fee type' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
