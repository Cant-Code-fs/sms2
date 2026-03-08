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

        const routes = await prisma.transportRoute.findMany({
            where: { school_id: params.schoolId },
            include: {
                _count: { select: { enrollments: { where: { is_active: true } } } },
            },
            orderBy: { route_name: 'asc' },
        });

        return NextResponse.json({
            success: true,
            data: routes.map(r => ({
                ...r,
                monthly_fee: Number(r.monthly_fee),
                enrolled_count: r._count.enrollments,
            })),
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

        const { route_name, description, monthly_fee } = await request.json();

        const route = await prisma.transportRoute.create({
            data: { school_id: params.schoolId, route_name, description: description || null, monthly_fee, is_active: true },
        });

        return NextResponse.json({ success: true, data: { ...route, monthly_fee: Number(route.monthly_fee) } }, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
