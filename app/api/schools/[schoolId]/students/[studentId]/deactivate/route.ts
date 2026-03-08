import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

export async function POST(
    _req: NextRequest,
    { params }: { params: { schoolId: string; studentId: string } }
) {
    try {
        const supabase = createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const staff = await prisma.staff.findUnique({ where: { supabase_uid: session.user.id }, select: { id: true, role: true } });
        if (!staff || !['super_admin', 'school_admin'].includes(staff.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const student = await prisma.student.findFirst({ where: { id: params.studentId, school_id: params.schoolId } });
        if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        if (!student.is_active) return NextResponse.json({ error: 'Already inactive' }, { status: 409 });

        await prisma.$transaction([
            prisma.student.update({ where: { id: params.studentId }, data: { is_active: false } }),
            prisma.auditLog.create({
                data: {
                    school_id: params.schoolId,
                    staff_id: staff.id,
                    action: 'student_deactivated',
                    entity_type: 'student',
                    entity_id: params.studentId,
                    old_value: { is_active: true },
                    new_value: { is_active: false },
                },
            }),
        ]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
