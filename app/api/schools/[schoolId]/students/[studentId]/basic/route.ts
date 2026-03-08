import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

// GET a specific student (basic info, for fee collection prefill)
export async function GET(
    _req: NextRequest,
    { params }: { params: { schoolId: string; studentId: string } }
) {
    try {
        const supabase = createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const student = await prisma.student.findFirst({
            where: { id: params.studentId, school_id: params.schoolId },
            include: { section: { include: { class: true } }, transport_enrollment: { include: { route: true } } },
        });

        if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

        return NextResponse.json({ success: true, data: student });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
