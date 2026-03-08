'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/tables/data-table';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatDateTime } from '@/lib/utils/formatDate';

interface DailyReportRow {
    id: string;
    receipt_number: string;
    student_name: string;
    admission_no: string;
    class_name: string;
    amount: number;
    late_fine: number;
    concession: number;
    payment_mode: string;
    payment_date: string;
    generated_by_name: string;
}

export default function DailyReportPage() {
    const params = useParams();
    const schoolId = params.schoolId as string;
    const today = new Date().toISOString().split('T')[0];
    const [reportDate, setReportDate] = useState(today);

    const { data, isLoading } = useQuery({
        queryKey: ['daily-report', schoolId, reportDate],
        queryFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/reports/daily?date=${reportDate}`);
            if (!res.ok) throw new Error('Failed');
            return res.json();
        },
    });

    const rows: DailyReportRow[] = data?.data || [];
    const summary = data?.summary || {};

    const columns = [
        { key: 'receipt_number', header: 'Receipt', render: (r: DailyReportRow) => <span className="font-mono text-xs font-bold text-[#1E3A5F]">{r.receipt_number}</span> },
        { key: 'student', header: 'Student', render: (r: DailyReportRow) => <div><p className="font-medium text-sm">{r.student_name}</p><p className="text-xs text-gray-400">{r.admission_no}</p></div> },
        { key: 'class', header: 'Class', render: (r: DailyReportRow) => r.class_name },
        { key: 'amount', header: 'Amount', render: (r: DailyReportRow) => <span className="font-semibold">{formatCurrency(r.amount)}</span> },
        { key: 'late_fine', header: 'Late Fine', render: (r: DailyReportRow) => <span className={r.late_fine > 0 ? 'text-red-600' : 'text-gray-300'}>{formatCurrency(r.late_fine)}</span> },
        { key: 'concession', header: 'Concession', render: (r: DailyReportRow) => <span className={r.concession > 0 ? 'text-amber-600' : 'text-gray-300'}>{formatCurrency(r.concession)}</span> },
        { key: 'mode', header: 'Mode', render: (r: DailyReportRow) => <Badge variant="default" size="sm">{r.payment_mode.toUpperCase()}</Badge> },
        { key: 'time', header: 'Time', render: (r: DailyReportRow) => <span className="text-xs text-gray-500">{formatDateTime(r.payment_date)}</span> },
        { key: 'by', header: 'Collected By', render: (r: DailyReportRow) => <span className="text-xs text-gray-500">{r.generated_by_name}</span> },
    ];

    const handleExport = async () => {
        const res = await fetch(`/api/schools/${schoolId}/reports/daily?date=${reportDate}&format=csv`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `daily-report-${reportDate}.csv`; a.click();
    };

    return (
        <AppLayout>
            <Header
                title="Daily Collection Report"
                subtitle="View fee collections for a specific day"
                actions={
                    <Button variant="secondary" onClick={handleExport}>⬇ Export CSV</Button>
                }
            />
            <div className="p-6 space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-end gap-4">
                    <Input label="Report Date" type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="w-48" max={today} />
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                        { label: 'Total Collected', value: formatCurrency(summary.total || 0), color: 'emerald' },
                        { label: 'Cash', value: formatCurrency(summary.cash || 0), color: 'blue' },
                        { label: 'UPI', value: formatCurrency(summary.upi || 0), color: 'purple' },
                        { label: 'Cheque', value: formatCurrency(summary.cheque || 0), color: 'amber' },
                        { label: 'Late Fines', value: formatCurrency(summary.lateFines || 0), color: 'red' },
                    ].map(s => (
                        <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                            <p className="text-lg font-bold text-gray-900">{s.value}</p>
                            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                        </div>
                    ))}
                </div>

                <DataTable
                    data={rows}
                    columns={columns}
                    loading={isLoading}
                    emptyMessage={`No collections on ${reportDate}`}
                    emptyIcon="📅"
                    getRowId={r => r.id}
                />
            </div>
        </AppLayout>
    );
}
