'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Header } from '@/components/layout/header';
import { DataTable } from '@/components/tables/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatDateTime } from '@/lib/utils/formatDate';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

interface Receipt {
    id: string;
    receipt_number: string;
    amount: number;
    late_fine: number;
    concession: number;
    payment_date: string;
    payment_mode: string;
    is_cancelled: boolean;
    cancel_reason: string | null;
    pdf_url: string | null;
    generated_by: string;
    student: {
        id: string;
        first_name: string;
        last_name: string;
        admission_no: string;
        section: { name: string; class: { name: string } };
    };
}

export default function ReceiptsPage() {
    const params = useParams();
    const schoolId = params.schoolId as string;
    const { hasPermission } = useAuth();
    const queryClient = useQueryClient();

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [modeFilter, setModeFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showCancelled, setShowCancelled] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    const [cancelModal, setCancelModal] = useState<{ open: boolean; receiptId: string; receiptNo: string }>({
        open: false, receiptId: '', receiptNo: '',
    });
    const [cancelReason, setCancelReason] = useState('');

    const handleSearch = (val: string) => {
        setSearch(val);
        clearTimeout((window as unknown as { _st?: number })._st);
        (window as unknown as { _st?: number })._st = window.setTimeout(() => { setDebouncedSearch(val); setPage(1); }, 300);
    };

    const { data, isLoading } = useQuery({
        queryKey: ['receipts', schoolId, debouncedSearch, modeFilter, dateFrom, dateTo, showCancelled, page, pageSize],
        queryFn: async () => {
            const p = new URLSearchParams({
                search: debouncedSearch,
                paymentMode: modeFilter,
                dateFrom,
                dateTo,
                showCancelled: String(showCancelled),
                page: String(page),
                pageSize: String(pageSize),
            });
            const res = await fetch(`/api/schools/${schoolId}/receipts?${p}`);
            if (!res.ok) throw new Error('Failed to fetch receipts');
            return res.json();
        },
    });

    const cancelMutation = useMutation({
        mutationFn: async ({ receiptId, reason }: { receiptId: string; reason: string }) => {
            const res = await fetch(`/api/schools/${schoolId}/receipts/${receiptId}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cancel_reason: reason }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Receipt cancelled');
            setCancelModal({ open: false, receiptId: '', receiptNo: '' });
            setCancelReason('');
            queryClient.invalidateQueries({ queryKey: ['receipts', schoolId] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const canCancel = hasPermission(['super_admin', 'school_admin', 'accountant']);

    const columns = [
        {
            key: 'receipt_number',
            header: 'Receipt No',
            render: (r: Receipt) => (
                <span className={`font-mono text-sm font-bold text-[#1E3A5F] ${r.is_cancelled ? 'line-through opacity-50' : ''}`}>
                    {r.receipt_number}
                    {r.is_cancelled && <span className="ml-2 text-xs text-red-500 font-normal not-italic">(Cancelled)</span>}
                </span>
            ),
        },
        {
            key: 'student',
            header: 'Student',
            render: (r: Receipt) => (
                <div>
                    <p className="font-medium text-sm">{r.student.first_name} {r.student.last_name}</p>
                    <p className="text-xs text-gray-400">{r.student.admission_no} · {r.student.section.class.name}-{r.student.section.name}</p>
                </div>
            ),
        },
        {
            key: 'amount',
            header: 'Amount',
            render: (r: Receipt) => <span className="font-semibold">{formatCurrency(r.amount)}</span>,
        },
        {
            key: 'late_fine',
            header: 'Late Fine',
            render: (r: Receipt) => (
                <span className={r.late_fine > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                    {formatCurrency(r.late_fine)}
                </span>
            ),
        },
        {
            key: 'mode',
            header: 'Mode',
            render: (r: Receipt) => <Badge variant="default" size="sm">{r.payment_mode.toUpperCase()}</Badge>,
        },
        {
            key: 'date',
            header: 'Date',
            render: (r: Receipt) => <span className="text-xs text-gray-500">{formatDateTime(r.payment_date)}</span>,
        },
        {
            key: 'status',
            header: 'Status',
            render: (r: Receipt) => (
                <Badge variant={r.is_cancelled ? 'danger' : 'success'} size="sm">
                    {r.is_cancelled ? 'Cancelled' : 'Valid'}
                </Badge>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            render: (r: Receipt) => (
                <div className="flex items-center gap-2">
                    <a href={`/api/receipts/${r.id}/pdf`} target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="sm">🖨️ Print</Button>
                    </a>
                    {!r.is_cancelled && canCancel && (
                        <Button
                            variant="danger"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setCancelModal({ open: true, receiptId: r.id, receiptNo: r.receipt_number }); }}
                        >
                            ✕ Cancel
                        </Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <AppLayout>
            <Header title="Receipts" subtitle="View and manage fee receipts" />
            <div className="p-6 space-y-4">
                {/* Filter bar */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-4 items-end">
                    <Select
                        label="Payment Mode"
                        options={[
                            { value: '', label: 'All Modes' },
                            { value: 'cash', label: 'Cash' },
                            { value: 'upi', label: 'UPI' },
                            { value: 'cheque', label: 'Cheque' },
                            { value: 'bank_transfer', label: 'Bank Transfer' },
                        ]}
                        value={modeFilter}
                        onChange={(e) => { setModeFilter(e.target.value); setPage(1); }}
                        className="w-44"
                    />
                    <Input label="From Date" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="w-40" />
                    <Input label="To Date" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="w-40" />
                    <label className="flex items-center gap-2 cursor-pointer mt-5">
                        <input
                            type="checkbox"
                            checked={showCancelled}
                            onChange={(e) => setShowCancelled(e.target.checked)}
                            className="rounded text-[#1E3A5F]"
                        />
                        <span className="text-sm text-gray-600">Show Cancelled</span>
                    </label>
                </div>

                <DataTable
                    data={data?.data || []}
                    columns={columns}
                    loading={isLoading}
                    searchPlaceholder="Search by receipt number, student name, admission no..."
                    onSearch={handleSearch}
                    searchValue={search}
                    totalItems={data?.total}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                    emptyMessage="No receipts found"
                    emptyIcon="🧾"
                    getRowId={(r) => r.id}
                />
            </div>

            {/* Cancel Receipt Modal */}
            <Modal
                isOpen={cancelModal.open}
                onClose={() => setCancelModal({ open: false, receiptId: '', receiptNo: '' })}
                title={`Cancel Receipt ${cancelModal.receiptNo}`}
                size="sm"
            >
                <div className="space-y-4">
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                        ⚠️ This action cannot be undone. The receipt will be marked as cancelled. One-time fee records will NOT be automatically reversed — you must handle re-collection manually.
                    </div>
                    <Input
                        label="Cancellation Reason"
                        placeholder="Enter reason for cancellation..."
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        required
                    />
                    <div className="flex gap-3">
                        <Button variant="secondary" className="flex-1" onClick={() => setCancelModal({ open: false, receiptId: '', receiptNo: '' })}>
                            Go Back
                        </Button>
                        <Button
                            variant="danger"
                            className="flex-1"
                            disabled={cancelReason.length < 5}
                            loading={cancelMutation.isPending}
                            onClick={() => cancelMutation.mutate({ receiptId: cancelModal.receiptId, reason: cancelReason })}
                        >
                            Confirm Cancel
                        </Button>
                    </div>
                </div>
            </Modal>
        </AppLayout>
    );
}
