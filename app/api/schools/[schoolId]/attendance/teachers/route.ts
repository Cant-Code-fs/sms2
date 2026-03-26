import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type AttendanceStatus = 'present' | 'absent' | 'leave';

function getISTDateString(d: Date) {
    return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });
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
        const dateStr = url.searchParams.get('date') || getISTDateString(new Date());
        const normalizedDate = new Date(`${dateStr}T00:00:00.000Z`);

        // Teachers are staff with role === 'teacher'
        const staffTeachers = await prisma.staff.findMany({
            where: { school_id: schoolId, role: 'teacher', is_active: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });

        const staffIds = staffTeachers.map((t) => t.id);
        if (staffIds.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        // Ensure Teacher records exist for those staff teachers.
        const existingTeachers = await prisma.teacher.findMany({
            where: { staffId: { in: staffIds } },
            select: { staffId: true },
        });
        const existingSet = new Set(existingTeachers.map((t) => t.staffId));
        const missing = staffTeachers.filter((t) => !existingSet.has(t.id));

        if (missing.length > 0) {
            await prisma.teacher.createMany({
                data: missing.map((t) => ({
                    staffId: t.id,
                    school_id: schoolId,
                    name: t.name,
                })),
                skipDuplicates: true,
            });
        }

        const teachers = await prisma.teacher.findMany({
            where: { staffId: { in: staffIds } },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });

        const teacherIds = teachers.map((t) => t.id);
        const attendance = await prisma.teacherAttendance.findMany({
            where: { teacherId: { in: teacherIds }, date: normalizedDate },
            select: { teacherId: true, status: true, checkIn: true, checkOut: true },
        });

        const attendanceMap = new Map(
            attendance.map((a) => [a.teacherId, a])
        );

        const data = teachers.map((t) => {
            const a = attendanceMap.get(t.id);
            return {
                teacherId: t.id,
                teacherName: t.name,
                date: dateStr,
                status: (a?.status as AttendanceStatus | undefined) || null,
                checkIn: a?.checkIn ? a.checkIn.toISOString() : null,
                checkOut: a?.checkOut ? a.checkOut.toISOString() : null,
            };
        });

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Teacher attendance GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

