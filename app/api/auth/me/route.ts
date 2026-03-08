import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';
import type { SessionUser } from '@/types';

export async function GET(request: NextRequest) {
    try {
        const supabase = createSupabaseServerClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Check if uid was provided (for initial fetch)
        const uid = request.nextUrl.searchParams.get('uid') || session.user.id;

        const staff = await prisma.staff.findUnique({
            where: { supabase_uid: uid },
            include: { school: true },
        });

        if (!staff) {
            return NextResponse.json({ error: 'Staff record not found' }, { status: 404 });
        }

        if (!staff.is_active) {
            return NextResponse.json({ error: 'Account is deactivated' }, { status: 403 });
        }

        const user: SessionUser = {
            id: staff.id,
            staffId: staff.id,
            name: staff.name,
            email: staff.email,
            role: staff.role as SessionUser['role'],
            schoolId: staff.school_id,
            supabaseUid: staff.supabase_uid,
        };

        return NextResponse.json({ user });
    } catch (error) {
        console.error('Auth me error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
