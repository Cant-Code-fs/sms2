/**
 * link-staff.ts
 * Run AFTER creating staff users manually in Supabase Auth Dashboard.
 * This script reads their UIDs and creates/updates the Staff DB records.
 *
 * Usage: npx ts-node --compiler-options {"module":"CommonJS"} prisma/link-staff.ts
 */

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

const SCHOOL1_ID = 'school-1-id';
const SCHOOL2_ID = 'school-2-id';

const staffConfig: Record<string, { name: string; role: string; school_id: string | null }> = {
    'superadmin@school.com': { name: 'Super Administrator', role: 'super_admin', school_id: null },
    'admin1@school.com': { name: 'Admin RS Public School', role: 'school_admin', school_id: SCHOOL1_ID },
    'admin2@school.com': { name: 'Admin RS Millennium School', role: 'school_admin', school_id: SCHOOL2_ID },
};

async function main() {
    console.log('🔗 Linking staff Auth users to database...\n');

    // Fetch all Supabase Auth users
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) {
        console.error('❌ Could not list Supabase users:', error.message);
        console.error('   Make sure SUPABASE_SERVICE_ROLE_KEY is correct in .env');
        process.exit(1);
    }

    const authUsers = data?.users ?? [];
    console.log(`📋 Found ${authUsers.length} user(s) in Supabase Auth\n`);

    let linked = 0;
    let missing = 0;

    for (const [email, config] of Object.entries(staffConfig)) {
        const authUser = authUsers.find(u => u.email === email);

        if (!authUser) {
            console.log(`⚠️  ${email} — NOT FOUND in Supabase Auth (create this user first)`);
            missing++;
            continue;
        }

        await prisma.staff.upsert({
            where: { supabase_uid: authUser.id },
            update: {
                name: config.name,
                email,
                role: config.role,
                school_id: config.school_id,
                is_active: true,
            },
            create: {
                supabase_uid: authUser.id,
                name: config.name,
                email,
                role: config.role,
                school_id: config.school_id,
                is_active: true,
            },
        });

        console.log(`✅ ${email} → linked (${config.role})`);
        linked++;
    }

    console.log(`\n🎉 Done! ${linked} staff linked, ${missing} missing.`);

    if (missing > 0) {
        console.log('\n📝 To create missing users:');
        console.log('   Supabase Dashboard → Authentication → Users → Add user → Create new user');
        console.log('   Password for all: School@1234');
        console.log('   Then re-run this script.\n');
    } else {
        console.log('\n✨ All staff linked! You can now log in at http://localhost:3000/login');
        console.log('   Email: superadmin@school.com');
        console.log('   Password: School@1234\n');
    }
}

main()
    .catch(e => { console.error('❌ Failed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
