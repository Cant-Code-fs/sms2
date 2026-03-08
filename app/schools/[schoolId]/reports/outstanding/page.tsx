'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DataTable } from '@/components/tables/data-table';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatDate } from '@/lib/utils/formatDate';
import toast from 'react-hot-toast';

interface ReportRow {
    id: string;
    studentName: string;
    admissionNo: string;
    className: string;
    sectionName: string;
    parentPhone: string;
    monthlyDues: number;
    transportDues: number;
    examDues: number;
    annualDues: number;
    totalOutstanding: number;
}

export default function OutstandingReport() {
    const params = useParams();
    const schoolId = params.schoolId as string;

    const [classFilter, setClassFilter] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [sendingReminders, setSendingReminders] = useState(false);

    const { data: classesData } = useQuery({
        queryKey: ['classes', schoolId],
        queryFn: async () => { const r = await fetch(`/api/schools/${schoolId}/classes`); return r.json(); },
    });

    const { data, isLoading } = useQuery({
        queryKey: ['outstanding-report', schoolId, classFilter],
        queryFn: async () => {
            const p = new URLSearchParams({ classId: classFilter });
            const r = await fetch(`/api/schools/${schoolId}/reports/outstanding?${p}`);
            if (!r.ok) throw new Error('Failed');
            return r.json();
        },
    });

    const handleSendReminders = async () => {
        setSendingReminders(true);
        const studentIds = Array.from(selectedIds);
        const res = await fetch(`/api/schools/${schoolId}/whatsapp/send-bulk-reminders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentIds }),
        });
        const result = await res.json();
        if (result.success) {
            toast.success(`${result.sent} messages sent, ${result.failed} failed`);
            setSelectedIds(new Set());
        } else {
            toast.error('Failed to send reminders');
        }
        setSendingReminders(false);
    };

    const classOptions = [
        { value: '', label: 'All Classes' },
        ...((classesData?.data || []).map((c: { id: string; name: string }) => ({ value: c.id, label: c.name }))),
    ];

    const columns = [
        { key: 'admissionNo', header: 'Adm No', render: (r: ReportRow) => <span className="font-mono text-xs text-[#1E3A5F]">{r.admissionNo}</span> },
        { key: 'student', header: 'Student', render: (r: ReportRow) => <span className="font-medium">{r.studentName}</span> },
        { key: 'class', header: 'Class', render: (r: ReportRow) => `${r.className}-${r.sectionName}` },
        { key: 'monthly', header: 'Monthly Dues', render: (r: ReportRow) => <span className={r.monthlyDues > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}>{formatCurrency(r.monthlyDues)}</span> },
        { key: 'transport', header: 'Transport Dues', render: (r: ReportRow) => <span className={r.transportDues > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}>{formatCurrency(r.transportDues)}</span> },
        { key: 'exam', header: 'Exam Dues', render: (r: ReportRow) => <span className={r.examDues > 0 ? 'text-purple-600 font-medium' : 'text-gray-400'}>{formatCurrency(r.examDues)}</span> },
        { key: 'annual', header: 'Annual Dues', render: (r: ReportRow) => <span className={r.annualDues > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}>{formatCurrency(r.annualDues)}</span> },
        {
            key: 'total',
            header: 'Total Outstanding',
            render: (r: ReportRow) => (
                <span className="font-bold text-red-600 text-base">{formatCurrency(r.totalOutstanding)}</span>
            ),
        },
    ];

    const totalOutstanding = (data?.data || []).reduce((s: number, r: ReportRow) => s + r.totalOutstanding, 0);

    return (
        <AppLayout>
            <Header
                title="Outstanding Dues"
                subtitle="Students with pending fee payments"
                actions={
                    <div className="flex gap-3">
                        {selectedIds.size > 0 && (
                            <Button variant="success" loading={sendingReminders} onClick={handleSendReminders}>
                                📱 Send WA Reminder ({selectedIds.size})
                            </Button>
                        )}
                        <Button variant="secondary" onClick={async () => {
                            const p = new URLSearchParams({ classId: classFilter, format: 'csv' });
                            const r = await fetch(`/api/schools/${schoolId}/reports/outstanding?${p}`);
                            const blob = await r.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a'); a.href = url; a.download = 'outstanding.csv'; a.click();
                        }}>
                            ⬇ Export CSV
                        </Button>
                    </div>
                }
            />
            <div className="p-6 space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                        <p className="text-2xl font-bold text-red-600">{formatCurrency(totalOutstanding)}</p>
                        <p className="text-xs text-gray-500 mt-1">Total Outstanding</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                        <p className="text-2xl font-bold text-gray-900">{(data?.data || []).length}</p>
                        <p className="text-xs text-gray-500 mt-1">Defaulters</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-4">
                    <Select
                        options={classOptions}
                        value={classFilter}
                        onChange={e => setClassFilter(e.target.value)}
                        className="w-44"
                    />
                </div>

                <DataTable
                    data={data?.data || []}
                    columns={columns}
                    loading={isLoading}
                    emptyMessage="No outstanding dues! 🎉"
                    emptyIcon="✅"
                    getRowId={(r) => r.id}
                    selectable
                    selectedIds={selectedIds}
                    onSelectChange={setSelectedIds}
                />
            </div>
        </AppLayout>
    );
}
