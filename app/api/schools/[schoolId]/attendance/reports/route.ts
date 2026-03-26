import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Prisma } from '@prisma/client';

type AttendanceStatus = 'present' | 'absent' | 'leave';

function normalizeDate(dateStr: string) {
    return new Date(`${dateStr}T00:00:00.000Z`);
}

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

        const dateFrom = url.searchParams.get('dateFrom');
        const dateTo = url.searchParams.get('dateTo');
        const teacherId = url.searchParams.get('teacherId');
        const status = url.searchParams.get('status');

        if (!dateFrom || !dateTo) {
            return NextResponse.json({ success: true, data: [] });
        }

        const from = normalizeDate(dateFrom);
        const to = normalizeDate(dateTo);

        const where: Prisma.TeacherAttendanceWhereInput = {
            teacher: { school_id: schoolId },
            date: { gte: from, lte: to },
        };

        if (teacherId) {
            where.teacherId = teacherId;
        }

        if (status && ['present', 'absent', 'leave'].includes(status)) {
            where.status = status as AttendanceStatus;
        }

        const records = await prisma.teacherAttendance.findMany({
            where,
            select: {
                id: true,
                teacherId: true,
                date: true,
                status: true,
                checkIn: true,
                checkOut: true,
                teacher: { select: { name: true } },
            },
            orderBy: { date: 'asc' },
        });

        const data = records.map((r) => ({
            id: r.id,
            teacherId: r.teacherId,
            teacherName: r.teacher.name,
            date: r.date.toISOString().split('T')[0],
            status: r.status as AttendanceStatus,
            checkIn: r.checkIn ? r.checkIn.toISOString() : null,
            checkOut: r.checkOut ? r.checkOut.toISOString() : null,
        }));

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Teacher attendance reports error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

