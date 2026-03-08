import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

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
            include: {
                section: { include: { class: true } },
                transport_enrollment: { include: { route: true } },
                receipts: {
                    orderBy: { payment_date: 'desc' },
                    include: { payments: true },
                },
            },
        });

        if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

        return NextResponse.json({
            success: true,
            data: {
                ...student,
                date_of_birth: student.date_of_birth.toISOString(),
                admission_date: student.admission_date.toISOString(),
                receipts: student.receipts.map(r => ({
                    ...r,
                    amount: Number(r.amount),
                    late_fine: Number(r.late_fine),
                    concession: Number(r.concession),
                    payment_date: r.payment_date.toISOString(),
                    transport_enrollment: student.transport_enrollment ? {
                        ...student.transport_enrollment,
                        start_date: student.transport_enrollment.start_date.toISOString(),
                        route: {
                            ...student.transport_enrollment.route,
                            monthly_fee: Number(student.transport_enrollment.route.monthly_fee),
                        },
                    } : null,
                })),
            },
        });
    } catch (error) {
        console.error('Student profile error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(
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

        const body = await request.json();
        const { first_name, last_name, parent_name, parent_phone, parent_email, address, section_id, photo_url } = body;

        let phone = parent_phone?.replace(/\D/g, '');
        if (phone?.length === 10) phone = `+91${phone}`;

        const updated = await prisma.student.update({
            where: { id: params.studentId },
            data: {
                ...(first_name && { first_name }),
                ...(last_name && { last_name }),
                ...(parent_name && { parent_name }),
                ...(phone && { parent_phone: phone }),
                ...(parent_email !== undefined && { parent_email }),
                ...(address !== undefined && { address }),
                ...(section_id && { section_id }),
                ...(photo_url && { photo_url }),
            },
            include: { section: { include: { class: true } } },
        });

        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        console.error('Update student error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
