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

        const school = await prisma.school.findUnique({ where: { id: params.schoolId } });
        if (!school) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        return NextResponse.json({ success: true, data: school });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { schoolId: string } }
) {
    try {
        const supabase = createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const staff = await prisma.staff.findUnique({ where: { supabase_uid: session.user.id }, select: { role: true } });
        if (!staff || !['super_admin', 'school_admin'].includes(staff.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const body = await request.json();
        const { name, address, phone, email, receipt_prefix, logo_url } = body;

        const updated = await prisma.school.update({
            where: { id: params.schoolId },
            data: { name, address, phone, email, receipt_prefix, ...(logo_url ? { logo_url } : {}) },
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
