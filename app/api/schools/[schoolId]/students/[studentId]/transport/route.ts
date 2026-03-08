import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

// Enroll in transport
export async function POST(
    request: NextRequest,
    { params }: { params: { schoolId: string; studentId: string } }
) {
    try {
        const supabase = createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const staff = await prisma.staff.findUnique({ where: { supabase_uid: session.user.id }, select: { role: true } });
        if (!staff || !['super_admin', 'school_admin'].includes(staff.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const { route_id, start_date } = await request.json();

        // Deactivate any existing enrollment
        await prisma.transportEnrollment.updateMany({
            where: { student_id: params.studentId, is_active: true },
            data: { is_active: false, end_date: new Date() },
        });

        const enrollment = await prisma.transportEnrollment.create({
            data: {
                student_id: params.studentId,
                route_id,
                start_date: new Date(start_date),
                is_active: true,
            },
            include: { route: true },
        });

        return NextResponse.json({ success: true, data: enrollment });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Unenroll from transport
export async function DELETE(
    _req: NextRequest,
    { params }: { params: { schoolId: string; studentId: string } }
) {
    try {
        const supabase = createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const staff = await prisma.staff.findUnique({ where: { supabase_uid: session.user.id }, select: { role: true } });
        if (!staff || !['super_admin', 'school_admin'].includes(staff.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        await prisma.transportEnrollment.updateMany({
            where: { student_id: params.studentId, is_active: true },
            data: { is_active: false, end_date: new Date() },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
