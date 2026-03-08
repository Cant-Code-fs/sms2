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
        const dateStr = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
        const format = url.searchParams.get('format') || '';

        const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
        const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);

        // Use IST offsets
        const ISToffset = 5.5 * 60 * 60 * 1000;
        const dayStartIST = new Date(dayStart.getTime() - ISToffset);
        const dayEndIST = new Date(dayEnd.getTime() - ISToffset);

        const receipts = await prisma.receipt.findMany({
            where: {
                school_id: schoolId,
                is_cancelled: false,
                payment_date: { gte: dayStartIST, lte: dayEndIST },
            },
            include: {
                student: { include: { section: { include: { class: true } } } },
            },
            orderBy: { payment_date: 'asc' },
        });

        // Fetch staff names
        const staffIds = [...new Set(receipts.map(r => r.generated_by))];
        const staffList = await prisma.staff.findMany({
            where: { id: { in: staffIds } },
            select: { id: true, name: true },
        });
        const staffMap = Object.fromEntries(staffList.map(s => [s.id, s.name]));

        const rows = receipts.map(r => ({
            id: r.id,
            receipt_number: r.receipt_number,
            student_name: `${r.student.first_name} ${r.student.last_name}`,
            admission_no: r.student.admission_no,
            class_name: `${r.student.section.class.name}-${r.student.section.name}`,
            amount: Number(r.amount),
            late_fine: Number(r.late_fine),
            concession: Number(r.concession),
            payment_mode: r.payment_mode,
            payment_date: r.payment_date.toISOString(),
            generated_by_name: staffMap[r.generated_by] || 'Unknown',
        }));

        const summary = {
            total: rows.reduce((s, r) => s + r.amount, 0),
            cash: rows.filter(r => r.payment_mode === 'cash').reduce((s, r) => s + r.amount, 0),
            upi: rows.filter(r => r.payment_mode === 'upi').reduce((s, r) => s + r.amount, 0),
            cheque: rows.filter(r => r.payment_mode === 'cheque').reduce((s, r) => s + r.amount, 0),
            bank_transfer: rows.filter(r => r.payment_mode === 'bank_transfer').reduce((s, r) => s + r.amount, 0),
            lateFines: rows.reduce((s, r) => s + r.late_fine, 0),
            concessions: rows.reduce((s, r) => s + r.concession, 0),
            count: rows.length,
        };

        if (format === 'csv') {
            const headers = ['Receipt No', 'Student', 'Adm No', 'Class', 'Amount', 'Late Fine', 'Concession', 'Mode', 'Time', 'Collected By'];
            const csvRows = [
                headers,
                ...rows.map(r => [r.receipt_number, r.student_name, r.admission_no, r.class_name, r.amount, r.late_fine, r.concession, r.payment_mode, r.payment_date, r.generated_by_name]),
            ];
            const csv = csvRows.map(row => row.map(v => `"${v}"`).join(',')).join('\n');
            return new NextResponse(csv, {
                headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="daily-${dateStr}.csv"` },
            });
        }

        return NextResponse.json({ success: true, data: rows, summary });
    } catch (error) {
        console.error('Daily report error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
