import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

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
        const search = url.searchParams.get('search') || '';
        const classId = url.searchParams.get('classId') || '';
        const sectionId = url.searchParams.get('sectionId') || '';
        const isActiveStr = url.searchParams.get('isActive') || '';
        const transportEnrolled = url.searchParams.get('transportEnrolled') || '';
        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('pageSize') || '25');
        const format = url.searchParams.get('format') || '';

        const where: Record<string, unknown> = { school_id: schoolId };

        if (search) {
            where.OR = [
                { first_name: { contains: search, mode: 'insensitive' } },
                { last_name: { contains: search, mode: 'insensitive' } },
                { admission_no: { contains: search, mode: 'insensitive' } },
                { parent_phone: { contains: search, mode: 'insensitive' } },
                { parent_name: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (isActiveStr !== '') {
            where.is_active = isActiveStr === 'true';
        }

        if (sectionId) {
            where.section_id = sectionId;
        } else if (classId) {
            where.section = { class_id: classId };
        }

        if (transportEnrolled === 'true') {
            where.transport_enrollment = { is_active: true };
        } else if (transportEnrolled === 'false') {
            where.transport_enrollment = null;
        }

        const [total, students] = await Promise.all([
            prisma.student.count({ where }),
            prisma.student.findMany({
                where,
                select: {
                    id: true,
                    school_id: true,
                    section_id: true,
                    admission_no: true,
                    first_name: true,
                    last_name: true,
                    date_of_birth: true,
                    gender: true,
                    parent_name: true,
                    parent_phone: true,
                    parent_email: true,
                    address: true,
                    photo_url: true,
                    is_active: true,
                    admission_date: true,
                    section: {
                        select: {
                            id: true,
                            name: true,
                            class: { select: { id: true, name: true, order: true } },
                        },
                    },
                    transport_enrollment: {
                        select: {
                            id: true,
                            is_active: true,
                            route: { select: { id: true, route_name: true, monthly_fee: true } },
                        },
                    },
                },
                orderBy: [{ section: { class: { order: 'asc' } } }, { section: { name: 'asc' } }, { first_name: 'asc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);

        // CSV export
        if (format === 'csv') {
            const allStudents = await prisma.student.findMany({
                where,
                select: {
                    id: true,
                    admission_no: true,
                    first_name: true,
                    last_name: true,
                    parent_name: true,
                    parent_phone: true,
                    parent_email: true,
                    is_active: true,
                    section: {
                        select: {
                            name: true,
                            class: { select: { name: true } },
                        },
                    },
                    transport_enrollment: {
                        select: { route: { select: { route_name: true } } },
                    },
                },
                orderBy: [{ section: { class: { order: 'asc' } } }, { first_name: 'asc' }],
            });
            const rows = [
                ['Adm No', 'First Name', 'Last Name', 'Class', 'Section', 'Parent Name', 'Parent Phone', 'Parent Email', 'Transport', 'Status'],
                ...allStudents.map(s => [
                    s.admission_no, s.first_name, s.last_name,
                    s.section.class.name, s.section.name,
                    s.parent_name, s.parent_phone, s.parent_email || '',
                    s.transport_enrollment?.route.route_name || 'None',
                    s.is_active ? 'Active' : 'Inactive',
                ]),
            ];
            const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
            return new NextResponse(csv, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': 'attachment; filename="students.csv"',
                },
            });
        }

        return NextResponse.json({
            success: true,
            data: students,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        });
    } catch (error) {
        console.error('Students list error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
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

        const {
            first_name, last_name, admission_no, date_of_birth, gender,
            section_id, parent_name, parent_phone, parent_email, address,
            photo_url, admission_date,
        } = body;

        // Normalize phone
        let phone = parent_phone.replace(/\D/g, '');
        if (phone.length === 10) phone = `+91${phone}`;
        if (!phone.startsWith('+91')) phone = `+91${phone.slice(-10)}`;

        const student = await prisma.$transaction(async (tx) => {
            const newStudent = await tx.student.create({
                data: {
                    school_id: schoolId,
                    section_id,
                    admission_no,
                    first_name,
                    last_name,
                    date_of_birth: new Date(date_of_birth),
                    gender,
                    parent_name,
                    parent_phone: phone,
                    parent_email: parent_email || null,
                    address: address || null,
                    photo_url: photo_url || null,
                    admission_date: admission_date ? new Date(admission_date) : new Date(),
                },
                include: { section: { include: { class: true } } },
            });

            // Get school's current academic year
            const school = await tx.school.findUnique({ where: { id: schoolId }, select: { current_academic_year: true } });
            const academicYear = school?.current_academic_year || '2024-25';

            // Auto-create OneTimeFeeRecord for annual charges and one-time fees
            const annualFeeTypes = await tx.feeType.findMany({
                where: {
                    school_id: schoolId,
                    fee_category: { in: ['annual', 'one_time'] },
                    is_active: true,
                },
            });

            const annualChargeTerms = await tx.annualChargeTerm.findMany({
                where: { school_id: schoolId, academic_year: academicYear, is_active: true },
            });

            const feeStructures = await tx.feeStructure.findMany({
                where: {
                    school_id: schoolId,
                    class_id: newStudent.section.class_id,
                    academic_year: academicYear,
                    is_active: true,
                    fee_type_id: { in: annualFeeTypes.map(ft => ft.id) },
                },
            });

            for (const feeType of annualFeeTypes) {
                const structure = feeStructures.find(fs => fs.fee_type_id === feeType.id);
                if (!structure) continue;

                const term = annualChargeTerms[0];
                if (!term) continue;

                // Check if record already exists
                const existing = await tx.oneTimeFeeRecord.findFirst({
                    where: {
                        student_id: newStudent.id,
                        fee_type_id: feeType.id,
                        academic_year: academicYear,
                        annual_charge_term_id: term.id,
                    },
                });

                if (!existing) {
                    await tx.oneTimeFeeRecord.create({
                        data: {
                            student_id: newStudent.id,
                            fee_type_id: feeType.id,
                            academic_year: academicYear,
                            annual_charge_term_id: term.id,
                            amount: structure.amount,
                            is_paid: false,
                        },
                    });
                }
            }

            return newStudent;
        });

        return NextResponse.json({ success: true, data: student }, { status: 201 });
    } catch (error) {
        console.error('Create student error:', error);
        if (error instanceof Error && error.message.includes('Unique constraint')) {
            return NextResponse.json({ error: 'Admission number already exists' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
