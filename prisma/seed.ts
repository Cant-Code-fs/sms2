import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

const ACADEMIC_YEAR = '2026-27';

async function createSupabaseUser(email: string, password: string = 'School@1234') {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    });
    if (error && !error.message.includes('already been registered')) {
        console.warn(`Could not create auth user ${email}: ${error.message}`);
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existing = listData?.users?.find(u => u.email === email);
        return existing?.id;
    }
    return data?.user?.id;
}

async function main() {
    console.log('🌱 Seeding database...');
    console.log('   Academic Year:', ACADEMIC_YEAR);

    // ─── Schools ─────────────────────────────────────────────────
    const [school1, school2] = await Promise.all([
        prisma.school.upsert({
            where: { id: 'school-1-id' },
            update: {
                name: 'RS Public School',
                address: 'Mirdha Tola, Sahukara Gate, Budaun 243601',
                phone: '+919756450765',
                email: 'rspubschool@gmail.com',
                receipt_prefix: 'RSP',
                current_academic_year: ACADEMIC_YEAR,
            },
            create: {
                id: 'school-1-id',
                name: 'RS Public School',
                address: 'Mirdha Tola, Sahukara Gate, Budaun 243601',
                phone: '+919756450765',
                email: 'rspubschool@gmail.com',
                receipt_prefix: 'RSP',
                receipt_counter: 1,
                current_academic_year: ACADEMIC_YEAR,
            },
        }),
        prisma.school.upsert({
            where: { id: 'school-2-id' },
            update: {
                name: 'RS Millennium School',
                address: 'Opp. FCI Godown, Bisauli Road, Budaun',
                phone: '+919761980445',
                email: 'rsmillenniumschool@gmail.com',
                receipt_prefix: 'RSM',
                current_academic_year: ACADEMIC_YEAR,
            },
            create: {
                id: 'school-2-id',
                name: 'RS Millennium School',
                address: 'Opp. FCI Godown, Bisauli Road, Budaun',
                phone: '+919761980445',
                email: 'rsmillenniumschool@gmail.com',
                receipt_prefix: 'RSM',
                receipt_counter: 1,
                current_academic_year: ACADEMIC_YEAR,
            },
        }),
    ]);
    console.log('✅ Schools created/updated');

    // ─── Classes & Sections ───────────────────────────────────────
    //
    // RS Public School:    P.G., L.K.G., U.K.G., Class 1–5   (8 classes)
    // RS Millennium School: P.G., L.K.G., U.K.G., Class 1–9  (12 classes)

    const school1ClassList = [
        { name: 'P.G.', order: 1 },
        { name: 'L.K.G.', order: 2 },
        { name: 'U.K.G.', order: 3 },
        { name: 'Class 1', order: 4 },
        { name: 'Class 2', order: 5 },
        { name: 'Class 3', order: 6 },
        { name: 'Class 4', order: 7 },
        { name: 'Class 5', order: 8 },
    ];

    const school2ClassList = [
        { name: 'P.G.', order: 1 },
        { name: 'L.K.G.', order: 2 },
        { name: 'U.K.G.', order: 3 },
        { name: 'Class 1', order: 4 },
        { name: 'Class 2', order: 5 },
        { name: 'Class 3', order: 6 },
        { name: 'Class 4', order: 7 },
        { name: 'Class 5', order: 8 },
        { name: 'Class 6', order: 9 },
        { name: 'Class 7', order: 10 },
        { name: 'Class 8', order: 11 },
        { name: 'Class 9', order: 12 },
    ];

    const createdClasses: Record<string, Array<{ id: string; name: string; order: number }>> = {
        [school1.id]: [],
        [school2.id]: [],
    };

    const allSchoolClasses: [string, typeof school1ClassList][] = [
        [school1.id, school1ClassList],
        [school2.id, school2ClassList],
    ];

    for (const [schoolId, classList] of allSchoolClasses) {
        for (const cls of classList) {
            const classId = `${schoolId}-class-${cls.order}`;
            const created = await prisma.class.upsert({
                where: { id: classId },
                update: { name: cls.name, order: cls.order },
                create: { id: classId, school_id: schoolId, name: cls.name, order: cls.order },
            });
            createdClasses[schoolId].push({ id: created.id, name: cls.name, order: cls.order });

            // Sections A and B for every class
            for (const secName of ['A', 'B']) {
                await prisma.section.upsert({
                    where: { id: `${created.id}-sec-${secName}` },
                    update: {},
                    create: { id: `${created.id}-sec-${secName}`, class_id: created.id, name: secName },
                });
            }
        }
    }
    console.log('✅ Classes and sections created/updated');

    // ─── Fee Types ────────────────────────────────────────────────
    // Shared across both schools
    const feeTypeDefinitions = [
        { name: 'Tuition Fee', fee_category: 'monthly', has_late_fine: true },
        { name: 'Examination Fee', fee_category: 'annual', has_late_fine: false },
        // Diary (₹180) + ID Card (₹70) = ₹250 total (charged together at collection)
        { name: 'Diary Charges', fee_category: 'one_time', has_late_fine: false },
        { name: 'ID Card Charges', fee_category: 'one_time', has_late_fine: false },
        // Admission — one-time for new students
        { name: 'Admission Charges', fee_category: 'one_time', has_late_fine: false },
        // Transport — only for students who opt in
        { name: 'Transport Fee', fee_category: 'transport', has_late_fine: false },
    ];

    const feeTypes: Record<string, Record<string, string>> = {
        [school1.id]: {},
        [school2.id]: {},
    };

    for (const schoolId of [school1.id, school2.id]) {
        for (const ft of feeTypeDefinitions) {
            const feeId = `${schoolId}-ft-${ft.name.toLowerCase().replace(/\s+/g, '-')}`;
            const created = await prisma.feeType.upsert({
                where: { id: feeId },
                update: { name: ft.name, fee_category: ft.fee_category, has_late_fine: ft.has_late_fine },
                create: {
                    id: feeId,
                    school_id: schoolId,
                    name: ft.name,
                    fee_category: ft.fee_category,
                    has_late_fine: ft.has_late_fine,
                    is_active: true,
                },
            });
            feeTypes[schoolId][ft.name] = created.id;
        }
    }
    console.log('✅ Fee types created/updated');

    // ─── Fee Structures ───────────────────────────────────────────
    //
    // RS PUBLIC SCHOOL fee matrix (per class name → amount in ₹)
    // ─────────────────────────────────────────────────────────────
    //   P.G.  / L.K.G. : Tuition ₹1300 | Exam ₹800
    //   U.K.G.          : Tuition ₹1400 | Exam ₹800
    //   Class 1         : Tuition ₹1400 | Exam ₹1000
    //   Class 2–4       : Tuition ₹1550 | Exam ₹1000
    //   Class 5         : Tuition ₹1650 | Exam ₹1000
    //   Diary ₹180 + ID Card ₹70 = ₹250 (all classes)
    //   Admission ₹1000 (all classes, new students only)

    const school1FeeMatrix: Record<string, Record<string, number> | { all: number }> = {
        'Tuition Fee': {
            'P.G.': 1300,
            'L.K.G.': 1300,
            'U.K.G.': 1400,
            'Class 1': 1400,
            'Class 2': 1550,
            'Class 3': 1550,
            'Class 4': 1550,
            'Class 5': 1650,
        },
        'Examination Fee': {
            'P.G.': 800,
            'L.K.G.': 800,
            'U.K.G.': 800,
            'Class 1': 1000,
            'Class 2': 1000,
            'Class 3': 1000,
            'Class 4': 1000,
            'Class 5': 1000,
        },
        'Diary Charges': { all: 180 },   // ₹180 + ₹70 ID card = ₹250 together
        'ID Card Charges': { all: 70 },
        'Admission Charges': { all: 1000 },
    };

    // ─────────────────────────────────────────────────────────────
    // RS MILLENNIUM SCHOOL fee matrix
    // ─────────────────────────────────────────────────────────────
    //   P.G. / L.K.G. / U.K.G. : Tuition ₹1050 | Exam ₹800
    //   Class 1–2               : Tuition ₹1200 | Exam ₹1000
    //   Class 3–5               : Tuition ₹1400 | Exam ₹1000
    //   Class 6–8               : Tuition ₹1850 | Exam ₹1200
    //   Class 9                 : Tuition ₹2800 | Exam ₹1500
    //   Diary ₹180 + ID Card ₹70 = ₹250 (all classes)
    //   Admission ₹1500 (all classes, new students only)

    const school2FeeMatrix: Record<string, Record<string, number> | { all: number }> = {
        'Tuition Fee': {
            'P.G.': 1050,
            'L.K.G.': 1050,
            'U.K.G.': 1050,
            'Class 1': 1200,
            'Class 2': 1200,
            'Class 3': 1400,
            'Class 4': 1400,
            'Class 5': 1400,
            'Class 6': 1850,
            'Class 7': 1850,
            'Class 8': 1850,
            'Class 9': 2800,
        },
        'Examination Fee': {
            'P.G.': 800,
            'L.K.G.': 800,
            'U.K.G.': 800,
            'Class 1': 1000,
            'Class 2': 1000,
            'Class 3': 1000,
            'Class 4': 1000,
            'Class 5': 1000,
            'Class 6': 1200,
            'Class 7': 1200,
            'Class 8': 1200,
            'Class 9': 1500,
        },
        'Diary Charges': { all: 180 },
        'ID Card Charges': { all: 70 },
        'Admission Charges': { all: 1500 },
    };

    const schoolFeeMatrices: [string, typeof school1FeeMatrix][] = [
        [school1.id, school1FeeMatrix],
        [school2.id, school2FeeMatrix],
    ];

    for (const [schoolId, feeMatrix] of schoolFeeMatrices) {
        const classes = createdClasses[schoolId];
        for (const cls of classes) {
            for (const [feeName, amountMap] of Object.entries(feeMatrix)) {
                const amount = 'all' in amountMap
                    ? (amountMap as { all: number }).all
                    : (amountMap as Record<string, number>)[cls.name];

                if (amount === undefined || amount === null) continue;

                const feeTypeId = feeTypes[schoolId][feeName];
                if (!feeTypeId) continue;

                const fsId = `${schoolId}-fs-${feeName.toLowerCase().replace(/\s+/g, '-')}-${cls.id}`;
                await prisma.feeStructure.upsert({
                    where: { id: fsId },
                    update: { amount },
                    create: {
                        id: fsId,
                        school_id: schoolId,
                        fee_type_id: feeTypeId,
                        class_id: cls.id,
                        amount,
                        academic_year: ACADEMIC_YEAR,
                        is_active: true,
                    },
                });
            }
        }
    }
    console.log('✅ Fee structures created/updated');

    // ─── Exam Terms ───────────────────────────────────────────────
    for (const schoolId of [school1.id, school2.id]) {
        await prisma.examTerm.upsert({
            where: { id: `${schoolId}-exam-half-yearly` },
            update: { name: 'Half Yearly 2026', due_date: new Date('2026-10-05'), academic_year: ACADEMIC_YEAR },
            create: {
                id: `${schoolId}-exam-half-yearly`,
                school_id: schoolId,
                name: 'Half Yearly 2026',
                due_date: new Date('2026-10-05'),
                academic_year: ACADEMIC_YEAR,
                is_active: true,
            },
        });
        await prisma.examTerm.upsert({
            where: { id: `${schoolId}-exam-annual` },
            update: { name: 'Annual 2026-27', due_date: new Date('2027-03-10'), academic_year: ACADEMIC_YEAR },
            create: {
                id: `${schoolId}-exam-annual`,
                school_id: schoolId,
                name: 'Annual 2026-27',
                due_date: new Date('2027-03-10'),
                academic_year: ACADEMIC_YEAR,
                is_active: true,
            },
        });
    }
    console.log('✅ Exam terms created/updated');

    // ─── Annual Charge Terms ──────────────────────────────────────
    for (const schoolId of [school1.id, school2.id]) {
        await prisma.annualChargeTerm.upsert({
            where: { id: `${schoolId}-annual-2026-27` },
            update: {},
            create: {
                id: `${schoolId}-annual-2026-27`,
                school_id: schoolId,
                name: 'Annual Charges 2026-27',
                due_date: new Date('2026-04-30'),
                academic_year: ACADEMIC_YEAR,
                is_active: true,
            },
        });
    }
    console.log('✅ Annual charge terms created/updated');

    // ─── Staff ────────────────────────────────────────────────────
    const staffData = [
        { email: 'superadmin@school.com', name: 'Super Administrator', role: 'super_admin', school_id: null },
        { email: 'admin1@school.com', name: 'Admin RS Public School', role: 'school_admin', school_id: school1.id },
        { email: 'admin2@school.com', name: 'Admin RS Millennium School', role: 'school_admin', school_id: school2.id },
    ];

    for (const s of staffData) {
        const uid = await createSupabaseUser(s.email);
        if (!uid) { console.warn(`Skipping staff ${s.email} — no UID`); continue; }

        await prisma.staff.upsert({
            where: { supabase_uid: uid },
            update: { name: s.name, role: s.role, school_id: s.school_id },
            create: {
                supabase_uid: uid,
                name: s.name,
                email: s.email,
                role: s.role,
                school_id: s.school_id,
                is_active: true,
            },
        });
    }
    console.log('✅ Staff created/updated (password: School@1234)');

    // ─── Summary ─────────────────────────────────────────────────
    console.log('\n🎉 Seeding complete!');
    console.log('\n📚 Schools:');
    console.log('   School 1 → RS Public School');
    console.log('             Classes: P.G., L.K.G., U.K.G., Class 1–5');
    console.log('             Admission: ₹1000 | Diary+ID Card: ₹250');
    console.log('   School 2 → RS Millennium School');
    console.log('             Classes: P.G., L.K.G., U.K.G., Class 1–9');
    console.log('             Admission: ₹1500 | Diary+ID Card: ₹250');
    console.log('\n💰 Fee Matrix (RS Public School):');
    console.log('   P.G. / L.K.G.  : Tuition ₹1300 | Exam ₹800');
    console.log('   U.K.G.          : Tuition ₹1400 | Exam ₹800');
    console.log('   Class 1         : Tuition ₹1400 | Exam ₹1000');
    console.log('   Class 2–4       : Tuition ₹1550 | Exam ₹1000');
    console.log('   Class 5         : Tuition ₹1650 | Exam ₹1000');
    console.log('\n💰 Fee Matrix (RS Millennium School):');
    console.log('   P.G.–U.K.G.    : Tuition ₹1050 | Exam ₹800');
    console.log('   Class 1–2       : Tuition ₹1200 | Exam ₹1000');
    console.log('   Class 3–5       : Tuition ₹1400 | Exam ₹1000');
    console.log('   Class 6–8       : Tuition ₹1850 | Exam ₹1200');
    console.log('   Class 9         : Tuition ₹2800 | Exam ₹1500');
    console.log('\n👤 Staff logins (password: School@1234):');
    staffData.forEach(s => console.log(`   - ${s.email} (${s.role})`));
    console.log('\n⚠️  Transport Fee is set up as a fee type but NOT auto-assigned.');
    console.log('   Add it manually per student who opts in via the Transport section.');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
