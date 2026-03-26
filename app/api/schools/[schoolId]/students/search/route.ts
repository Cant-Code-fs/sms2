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
        const q = new URL(request.url).searchParams.get('q') || '';

        if (q.length < 2) return NextResponse.json({ success: true, data: [] });

        const students = await prisma.student.findMany({
            where: {
                school_id: schoolId,
                is_active: true,
                OR: [
                    { first_name: { contains: q, mode: 'insensitive' } },
                    { last_name: { contains: q, mode: 'insensitive' } },
                    { admission_no: { contains: q, mode: 'insensitive' } },
                    { parent_phone: { contains: q, mode: 'insensitive' } },
                ],
            },
            select: {
                id: true,
                first_name: true,
                last_name: true,
                admission_no: true,
                photo_url: true,
                parent_name: true,
                parent_phone: true,
                section: {
                    select: {
                        name: true,
                        class: { select: { name: true } },
                    },
                },
            },
            take: 8,
            orderBy: { first_name: 'asc' },
        });

        return NextResponse.json({ success: true, data: students });
    } catch (error) {
        console.error('Student search error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
