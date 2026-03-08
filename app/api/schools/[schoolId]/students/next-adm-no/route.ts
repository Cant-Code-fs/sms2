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

        // Count existing students to generate next number
        const count = await prisma.student.count({ where: { school_id: params.schoolId } });
        const school = await prisma.school.findUnique({
            where: { id: params.schoolId },
            select: { receipt_prefix: true },
        });

        const prefix = school?.receipt_prefix || 'SCH';
        const admissionNo = `${prefix}-${String(count + 1).padStart(4, '0')}`;

        return NextResponse.json({ success: true, data: { admissionNo } });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
