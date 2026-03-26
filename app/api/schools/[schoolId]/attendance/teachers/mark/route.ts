import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type AttendanceStatus = 'present' | 'absent' | 'leave';

function isValidStatus(status: unknown): status is AttendanceStatus {
    return status === 'present' || status === 'absent' || status === 'leave';
}

function normalizeDate(dateStr: string) {
    return new Date(`${dateStr}T00:00:00.000Z`);
}

export async function POST(
    request: NextRequest,
    { params }: { params: { schoolId: string } }
) {
    try {
        const supabase = createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { schoolId } = params;
        const body = await request.json();

        const { date, items } = body as {
            date: string;
            items: Array<{
                teacherId: string;
                status: AttendanceStatus;
                checkIn?: string | null;
                checkOut?: string | null;
            }>;
        };

        if (!date || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const normalizedDate = normalizeDate(date);
        const now = new Date();

        // Validate + normalize each item before writing.
        const normalizedItems = items.map((it) => {
            const status: AttendanceStatus = isValidStatus(it.status) ? it.status : 'absent';

            if (status !== 'present') {
                return { teacherId: it.teacherId, status, checkIn: null as Date | null, checkOut: null as Date | null };
            }

            const checkIn = it.checkIn ? new Date(it.checkIn) : now;
            const checkOut = it.checkOut ? new Date(it.checkOut) : null;

            return { teacherId: it.teacherId, status, checkIn, checkOut };
        });

        // Ensure teacherIds belong to this school (prevents cross-school writes).
        const teacherIds = Array.from(new Set(normalizedItems.map((i) => i.teacherId)));
        const allowed = await prisma.teacher.findMany({
            where: {
                id: { in: teacherIds },
                // teacher.school_id is optional, but attendance is school-scoped in UI/API
                school_id: schoolId,
            },
            select: { id: true },
        });
        const allowedSet = new Set(allowed.map((t) => t.id));

        const toWrite = normalizedItems.filter((i) => allowedSet.has(i.teacherId));
        if (toWrite.length === 0) {
            return NextResponse.json({ error: 'No allowed teachers found' }, { status: 403 });
        }

        await prisma.$transaction(
            toWrite.map((it) =>
                prisma.teacherAttendance.upsert({
                    where: {
                        teacherId_date: {
                            teacherId: it.teacherId,
                            date: normalizedDate,
                        },
                    },
                    create: {
                        teacherId: it.teacherId,
                        date: normalizedDate,
                        status: it.status,
                        checkIn: it.checkIn,
                        checkOut: it.checkOut,
                    },
                    update: {
                        status: it.status,
                        checkIn: it.checkIn,
                        checkOut: it.checkOut,
                    },
                })
            )
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Teacher attendance mark error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

