import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';

function normalizePhone(phone: string | undefined | null) {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+91${digits}`;
    if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
    if (digits.startsWith('+')) return phone;
    return phone.startsWith('+') ? phone : `+91${digits}`;
}

async function getAuthedStaffRole(supabase: ReturnType<typeof createSupabaseServerClient>) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const staff = await prisma.staff.findUnique({
        where: { supabase_uid: session.user.id },
        select: { role: true },
    });
    return staff?.role ?? null;
}

export async function GET(
    request: NextRequest,
    { params }: { params: { schoolId: string } }
) {
    try {
        const supabase = createSupabaseServerClient();
        const role = await getAuthedStaffRole(supabase);
        if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!['super_admin', 'school_admin'].includes(role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const teachers = await prisma.staff.findMany({
            where: { school_id: params.schoolId, role: 'teacher' },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                is_active: true,
                created_at: true,
            },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json({ success: true, data: teachers });
    } catch (error) {
        console.error('Teachers list error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { schoolId: string } }
) {
    try {
        const supabase = createSupabaseServerClient();
        const role = await getAuthedStaffRole(supabase);
        if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if (!['super_admin', 'school_admin'].includes(role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const body = await request.json();
        const name: string = (body?.name ?? '').trim();
        const email: string = (body?.email ?? '').trim().toLowerCase();
        const phoneRaw: string | undefined = typeof body?.phone === 'string' ? body.phone : undefined;

        if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

        const phone = normalizePhone(phoneRaw);
        const password = 'School@1234';

        const supabaseAdmin = createSupabaseServiceClient();

        // Create/update Supabase Auth user.
        const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });

        let supabaseUid = createData?.user?.id;

        if (!supabaseUid) {
            // If the user already exists, fetch UID and proceed.
            if (createError && createError.message?.includes('already been registered')) {
                const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
                supabaseUid = listData?.users?.find((u) => u.email === email)?.id;
            }
        }

        if (!supabaseUid) {
            return NextResponse.json({ error: 'Failed to create auth user' }, { status: 500 });
        }

        // Create/update DB staff record (role=teacher).
        const teacher = await prisma.staff.upsert({
            where: { email },
            update: {
                name,
                phone,
                role: 'teacher',
                school_id: params.schoolId,
                is_active: true,
                supabase_uid: supabaseUid,
            },
            create: {
                supabase_uid: supabaseUid,
                school_id: params.schoolId,
                name,
                email,
                phone,
                role: 'teacher',
                is_active: true,
            },
        });

        return NextResponse.json({ success: true, data: teacher }, { status: 201 });
    } catch (error) {
        console.error('Add teacher error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

