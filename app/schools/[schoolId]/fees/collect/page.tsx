'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Header } from '@/components/layout/header';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatDate } from '@/lib/utils/formatDate';
import toast from 'react-hot-toast';
import Image from 'next/image';
import type { StudentDues, MonthlyFeeDue, TransportFeeDue, ExamFeeDue, AnnualFeeDue, OneTimeFeeDue, PaymentMode } from '@/types';

interface SearchResult {
    id: string;
    first_name: string;
    last_name: string;
    admission_no: string;
    photo_url: string | null;
    parent_name: string;
    parent_phone: string;
    section: { name: string; class: { name: string } };
}

export default function FeeCollectionPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const schoolId = params.schoolId as string;
    const prefillStudentId = searchParams.get('studentId');

    // State
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [showSearch, setShowSearch] = useState(true);
    const [selectedStudent, setSelectedStudent] = useState<SearchResult | null>(null);
    const [dues, setDues] = useState<StudentDues | null>(null);
    const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
    const [chequeNumber, setChequeNumber] = useState('');
    const [upiTxnId, setUpiTxnId] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [concession, setConcession] = useState(0);
    const [concessionReason, setConcessionReason] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successData, setSuccessData] = useState<{ receiptNumber: string; amount: number; receiptId: string } | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // Focus search on mount
    useEffect(() => {
        if (!prefillStudentId) searchRef.current?.focus();
    }, [prefillStudentId]);

    // Prefill student from URL param
    useEffect(() => {
        if (prefillStudentId) {
            (async () => {
                const res = await fetch(`/api/schools/${schoolId}/students/${prefillStudentId}/basic`);
                if (res.ok) {
                    const d = await res.json();
                    handleSelectStudent(d.data);
                }
            })();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prefillStudentId, schoolId]);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
        return () => clearTimeout(t);
    }, [searchQuery]);

    const { data: searchResults, isLoading: searchLoading } = useQuery({
        queryKey: ['student-search', schoolId, debouncedQuery],
        queryFn: async () => {
            if (debouncedQuery.length < 2) return { data: [] };
            const res = await fetch(`/api/schools/${schoolId}/students/search?q=${encodeURIComponent(debouncedQuery)}`);
            return res.json();
        },
        enabled: debouncedQuery.length >= 2,
    });

    const { data: duesData, isLoading: duesLoading } = useQuery({
        queryKey: ['student-dues', schoolId, selectedStudent?.id],
        queryFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/fees/dues/${selectedStudent!.id}`);
            if (!res.ok) throw new Error('Failed to fetch dues');
            return res.json();
        },
        enabled: !!selectedStudent,
    });

    useEffect(() => {
        if (duesData?.data) {
            // Mark all as selected by default
            const d: StudentDues = duesData.data;
            setDues({
                studentId: d.studentId,
                monthly: d.monthly.map((m) => ({ ...m, selected: true })),
                transport: d.transport.map((t) => ({ ...t, selected: true })),
                examination: d.examination.map((e) => ({ ...e, selected: true })),
                annual: d.annual.map((a) => ({ ...a, selected: true })),
                oneTime: d.oneTime.map((o) => ({ ...o, selected: true })),
            });
        }
    }, [duesData]);

    const handleSelectStudent = (student: SearchResult) => {
        setSelectedStudent(student);
        setShowSearch(false);
        setSearchQuery('');
        setDues(null);
    };

    const toggleMonthly = (idx: number) => {
        setDues((prev) => {
            if (!prev) return prev;
            const monthly = [...prev.monthly];
            monthly[idx] = { ...monthly[idx], selected: !monthly[idx].selected };
            return { ...prev, monthly };
        });
    };

    const toggleTransport = (idx: number) => {
        setDues((prev) => {
            if (!prev) return prev;
            const transport = [...prev.transport];
            transport[idx] = { ...transport[idx], selected: !transport[idx].selected };
            return { ...prev, transport };
        });
    };

    const toggleExam = (idx: number) => {
        setDues((prev) => {
            if (!prev) return prev;
            const examination = [...prev.examination];
            examination[idx] = { ...examination[idx], selected: !examination[idx].selected };
            return { ...prev, examination };
        });
    };

    const toggleAnnual = (idx: number) => {
        setDues((prev) => {
            if (!prev) return prev;
            const annual = [...prev.annual];
            annual[idx] = { ...annual[idx], selected: !annual[idx].selected };
            return { ...prev, annual };
        });
    };

    const toggleOneTime = (idx: number) => {
        setDues((prev) => {
            if (!prev) return prev;
            const oneTime = [...prev.oneTime];
            oneTime[idx] = { ...oneTime[idx], selected: !oneTime[idx].selected };
            return { ...prev, oneTime };
        });
    };

    // Calculate totals
    const selectedMonthly = dues?.monthly.filter((m) => m.selected) || [];
    const selectedTransport = dues?.transport.filter((t) => t.selected) || [];
    const selectedExam = dues?.examination.filter((e) => e.selected) || [];
    const selectedAnnual = dues?.annual.filter((a) => a.selected) || [];
    const selectedOneTime = dues?.oneTime.filter((o) => o.selected) || [];

    const monthlyTotal = selectedMonthly.reduce((s, m) => s + m.amount, 0);
    const monthlyLateFines = selectedMonthly.reduce((s, m) => s + m.lateFine, 0);
    const transportTotal = selectedTransport.reduce((s, t) => s + t.amount, 0);
    const transportLateFines = selectedTransport.reduce((s, t) => s + t.lateFine, 0);
    const examTotal = selectedExam.reduce((s, e) => s + e.amount, 0);
    const examLateFines = selectedExam.reduce((s, e) => s + e.lateFine, 0);
    const annualTotal = selectedAnnual.reduce((s, a) => s + a.amount, 0);
    const oneTimeTotal = selectedOneTime.reduce((s, o) => s + o.amount, 0);
    const subtotal = monthlyTotal + monthlyLateFines + transportTotal + transportLateFines + examTotal + examLateFines + annualTotal + oneTimeTotal;
    const netPayable = Math.max(0, subtotal - concession);

    const hasAnySelected = selectedMonthly.length > 0 || selectedTransport.length > 0 || selectedExam.length > 0 || selectedAnnual.length > 0 || selectedOneTime.length > 0;

    const collectMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                studentId: selectedStudent!.id,
                selectedMonthly,
                selectedTransport,
                selectedExam,
                selectedAnnual,
                selectedOneTime,
                concession,
                concessionReason,
                paymentMode,
                chequeNumber,
                upiTxnId,
                paymentDate,
                notes,
                totalAmount: netPayable,
                lateFineTotal: monthlyLateFines + transportLateFines + examLateFines,
            };

            const res = await fetch(`/api/schools/${schoolId}/fees/collect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to collect fee');
            }
            return res.json();
        },
        onSuccess: (data) => {
            setShowPreview(false);
            setShowSuccess(true);
            setSuccessData({
                receiptNumber: data.data.receiptNumber,
                amount: data.data.amount,
                receiptId: data.data.receiptId,
            });
            queryClient.invalidateQueries({ queryKey: ['student-dues'] });
        },
        onError: (err: Error) => {
            toast.error(err.message);
            setShowPreview(false);
        },
    });

    const resetForm = () => {
        setSelectedStudent(null);
        setDues(null);
        setShowSearch(true);
        setShowSuccess(false);
        setSuccessData(null);
        setConcession(0);
        setConcessionReason('');
        setPaymentMode('cash');
        setChequeNumber('');
        setUpiTxnId('');
        setNotes('');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setTimeout(() => searchRef.current?.focus(), 100);
    };

    const sendWhatsApp = async () => {
        if (!successData || !selectedStudent) return;
        const res = await fetch(`/api/schools/${schoolId}/whatsapp/send-confirmation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ receiptId: successData.receiptId, studentId: selectedStudent.id }),
        });
        if (res.ok) toast.success('WhatsApp confirmation sent!');
        else toast.error('Failed to send WhatsApp message');
    };

    // ─── Render ───────────────────────────────────────────────────
    if (showSuccess && successData) {
        return (
            <AppLayout>
                <Header title="Fee Collection" />
                <div className="p-6 flex items-center justify-center min-h-[60vh]">
                    <Card className="max-w-lg w-full text-center">
                        <div className="text-6xl mb-4">✅</div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Fee Collected Successfully!</h2>
                        <p className="text-gray-500 mb-6">Receipt has been generated and saved.</p>

                        <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Receipt Number</span>
                                <span className="font-mono font-bold text-[#1E3A5F]">{successData.receiptNumber}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Amount Collected</span>
                                <span className="font-bold text-emerald-600">{formatCurrency(successData.amount)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Student</span>
                                <span className="font-medium">{selectedStudent?.first_name} {selectedStudent?.last_name}</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <a href={`/api/receipts/${successData.receiptId}/pdf`} target="_blank" rel="noreferrer">
                                <Button variant="primary" className="w-full">🖨️ Print Receipt</Button>
                            </a>
                            <Button variant="success" onClick={sendWhatsApp} className="w-full">
                                📱 Send WhatsApp Confirmation
                            </Button>
                            <Button variant="secondary" onClick={resetForm} className="w-full">
                                💰 Collect Another Fee
                            </Button>
                        </div>
                    </Card>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <Header title="Collect Fee" subtitle="Fast, accurate fee collection" />
            <div className="p-6">
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Left panel — Student search + Dues */}
                    <div className="flex-1 space-y-4">

                        {/* STEP 1: Student Search */}
                        {showSearch && (
                            <Card>
                                <h3 className="text-base font-semibold text-gray-900 mb-3">🔍 Find Student</h3>
                                <div className="relative">
                                    <Input
                                        ref={searchRef}
                                        placeholder="Search by name, admission number, or parent phone..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        icon={
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        }
                                    />
                                    {/* Dropdown results */}
                                    {debouncedQuery.length >= 2 && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl z-20 max-h-72 overflow-y-auto">
                                            {searchLoading ? (
                                                <div className="p-4 text-center text-sm text-gray-500">Searching...</div>
                                            ) : (searchResults?.data || []).length === 0 ? (
                                                <div className="p-4 text-center text-sm text-gray-500">No students found</div>
                                            ) : (
                                                (searchResults?.data || []).map((student: SearchResult) => (
                                                    <button
                                                        key={student.id}
                                                        onClick={() => handleSelectStudent(student)}
                                                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                                                    >
                                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-[#1E3A5F] font-bold text-sm shrink-0">
                                                            {student.photo_url ? (
                                                                <Image src={student.photo_url} alt="" width={40} height={40} className="rounded-full object-cover" />
                                                            ) : `${student.first_name[0]}${student.last_name[0]}`}
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-sm font-semibold text-gray-900">{student.first_name} {student.last_name}</p>
                                                            <p className="text-xs text-gray-500">{student.admission_no} · {student.section.class.name}-{student.section.name} · {student.parent_phone}</p>
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        )}

                        {/* STEP 2: Selected Student Card */}
                        {selectedStudent && (
                            <Card className="border-2 border-[#1E3A5F]/20">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-[#1E3A5F] font-bold text-xl shrink-0">
                                        {selectedStudent.photo_url ? (
                                            <Image src={selectedStudent.photo_url} alt="" width={56} height={56} className="rounded-xl object-cover" />
                                        ) : `${selectedStudent.first_name[0]}${selectedStudent.last_name[0]}`}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-gray-900">{selectedStudent.first_name} {selectedStudent.last_name}</h3>
                                        <p className="text-sm text-gray-500">{selectedStudent.admission_no} · {selectedStudent.section.class.name}-{selectedStudent.section.name}</p>
                                        <p className="text-sm text-gray-500">Parent: {selectedStudent.parent_name} · {selectedStudent.parent_phone}</p>
                                    </div>
                                    <button
                                        onClick={() => { setSelectedStudent(null); setDues(null); setShowSearch(true); }}
                                        className="text-sm text-[#1E3A5F] font-medium hover:underline"
                                    >
                                        Change ↗
                                    </button>
                                </div>
                            </Card>
                        )}

                        {/* STEP 3: Dues Breakdown */}
                        {selectedStudent && (
                            <div className="space-y-4">
                                {duesLoading ? (
                                    <Card>
                                        <div className="text-center py-8 text-gray-400">Loading dues...</div>
                                    </Card>
                                ) : (
                                    <>
                                        {/* Monthly Fees */}
                                        {(dues?.monthly || []).length > 0 && (
                                            <Card>
                                                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                                                    <span>📅 Monthly Fees</span>
                                                    <Badge variant="warning" size="sm">{dues!.monthly.filter(m => m.selected).length} selected</Badge>
                                                </h4>
                                                <div className="space-y-2">
                                                    {dues!.monthly.map((m, i) => (
                                                        <div
                                                            key={`${m.feeTypeId}-${m.month}`}
                                                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${m.selected ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}
                                                            onClick={() => toggleMonthly(i)}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={m.selected}
                                                                onChange={() => toggleMonthly(i)}
                                                                className="rounded border-gray-300 text-[#1E3A5F]"
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                            <div className="flex-1">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-sm font-medium text-gray-800">{m.feeTypeName} — {m.month}</span>
                                                                    <span className="text-sm font-semibold">{formatCurrency(m.amount)}</span>
                                                                </div>
                                                                {m.lateFine > 0 && (
                                                                    <div className="flex justify-between items-center mt-1">
                                                                        <span className="text-xs text-red-500">⚠️ Late Fine</span>
                                                                        <span className="text-xs text-red-600 font-medium">{formatCurrency(m.lateFine)}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Card>
                                        )}

                                        {/* Transport Fees */}
                                        {(dues?.transport || []).length > 0 && (
                                            <Card>
                                                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                                                    <span>🚌 Transport Fees</span>
                                                    <Badge variant="info" size="sm">{dues!.transport.filter(t => t.selected).length} selected</Badge>
                                                </h4>
                                                <div className="space-y-2">
                                                    {dues!.transport.map((t, i) => (
                                                        <div
                                                            key={`${t.routeId}-${t.month}`}
                                                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${t.selected ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}
                                                            onClick={() => toggleTransport(i)}
                                                        >
                                                            <input type="checkbox" checked={t.selected} onChange={() => toggleTransport(i)} className="rounded border-gray-300 text-[#1E3A5F]" onClick={e => e.stopPropagation()} />
                                                            <div className="flex-1">
                                                                <div className="flex justify-between">
                                                                    <span className="text-sm font-medium">{t.routeName} — {t.month}</span>
                                                                    <span className="text-sm font-semibold">{formatCurrency(t.amount)}</span>
                                                                </div>
                                                                {t.lateFine > 0 && (
                                                                    <div className="flex justify-between mt-1">
                                                                        <span className="text-xs text-red-500">⚠️ Late Fine</span>
                                                                        <span className="text-xs text-red-600 font-medium">{formatCurrency(t.lateFine)}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Card>
                                        )}

                                        {/* Examination Fees */}
                                        {(dues?.examination || []).length > 0 && (
                                            <Card>
                                                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">📝 Examination Fees</h4>
                                                <div className="space-y-2">
                                                    {dues!.examination.map((e, i) => (
                                                        <div key={e.oneTimeFeeRecordId} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${e.selected ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-100 opacity-60'}`} onClick={() => toggleExam(i)}>
                                                            <input type="checkbox" checked={e.selected} onChange={() => toggleExam(i)} className="rounded" onClick={ev => ev.stopPropagation()} />
                                                            <div className="flex-1">
                                                                <div className="flex justify-between">
                                                                    <span className="text-sm font-medium">{e.feeTypeName} — {e.termName}</span>
                                                                    <span className="text-sm font-semibold">{formatCurrency(e.amount)}</span>
                                                                </div>
                                                                {e.lateFine > 0 && (
                                                                    <div className="flex justify-between mt-1">
                                                                        <span className="text-xs text-red-500">⚠️ Late Fine</span>
                                                                        <span className="text-xs text-red-600 font-medium">{formatCurrency(e.lateFine)}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Card>
                                        )}

                                        {/* Annual Charges */}
                                        {(dues?.annual || []).length > 0 && (
                                            <Card>
                                                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">💼 Annual Charges</h4>
                                                <div className="space-y-2">
                                                    {dues!.annual.map((a, i) => (
                                                        <div key={a.oneTimeFeeRecordId} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${a.selected ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100 opacity-60'}`} onClick={() => toggleAnnual(i)}>
                                                            <input type="checkbox" checked={a.selected} onChange={() => toggleAnnual(i)} className="rounded" onClick={ev => ev.stopPropagation()} />
                                                            <div className="flex justify-between flex-1">
                                                                <span className="text-sm font-medium">{a.feeTypeName} — {a.termName}</span>
                                                                <span className="text-sm font-semibold">{formatCurrency(a.amount)}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Card>
                                        )}

                                        {/* One-Time Fees */}
                                        {(dues?.oneTime || []).length > 0 && (
                                            <Card>
                                                <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">🎫 One-Time Charges</h4>
                                                <div className="space-y-2">
                                                    {dues!.oneTime.map((o, i) => (
                                                        <div key={o.oneTimeFeeRecordId} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${o.selected ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-100 opacity-60'}`} onClick={() => toggleOneTime(i)}>
                                                            <input type="checkbox" checked={o.selected} onChange={() => toggleOneTime(i)} className="rounded" onClick={ev => ev.stopPropagation()} />
                                                            <div className="flex justify-between flex-1">
                                                                <span className="text-sm font-medium">{o.feeTypeName} — {o.termName}</span>
                                                                <span className="text-sm font-semibold">{formatCurrency(o.amount)}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Card>
                                        )}

                                        {selectedStudent && !duesLoading && dues &&
                                            dues.monthly.length === 0 && dues.transport.length === 0 &&
                                            dues.examination.length === 0 && dues.annual.length === 0 && dues.oneTime.length === 0 && (
                                                <Card className="text-center py-12">
                                                    <div className="text-4xl mb-3">🎉</div>
                                                    <p className="text-gray-600 font-medium">All fees are paid up!</p>
                                                    <p className="text-sm text-gray-400 mt-1">This student has no outstanding dues.</p>
                                                </Card>
                                            )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right panel — Payment Summary (sticky) */}
                    {selectedStudent && (
                        <div className="w-full lg:w-96 shrink-0">
                            <div className="sticky top-4">
                                <Card className="border-2 border-[#1E3A5F]/20">
                                    <h3 className="text-base font-bold text-gray-900 mb-4 pb-3 border-b border-gray-100">
                                        PAYMENT SUMMARY
                                    </h3>

                                    {/* Breakdown lines */}
                                    <div className="space-y-2 text-sm">
                                        {monthlyTotal > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Monthly Fees</span>
                                                <span className="font-medium">{formatCurrency(monthlyTotal)}</span>
                                            </div>
                                        )}
                                        {monthlyLateFines > 0 && (
                                            <div className="flex justify-between text-red-600">
                                                <span>Monthly Late Fines</span>
                                                <span className="font-medium">{formatCurrency(monthlyLateFines)}</span>
                                            </div>
                                        )}
                                        {transportTotal > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Transport Fees</span>
                                                <span className="font-medium">{formatCurrency(transportTotal)}</span>
                                            </div>
                                        )}
                                        {transportLateFines > 0 && (
                                            <div className="flex justify-between text-red-600">
                                                <span>Transport Late Fines</span>
                                                <span className="font-medium">{formatCurrency(transportLateFines)}</span>
                                            </div>
                                        )}
                                        {examTotal > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Examination Fee</span>
                                                <span className="font-medium">{formatCurrency(examTotal)}</span>
                                            </div>
                                        )}
                                        {examLateFines > 0 && (
                                            <div className="flex justify-between text-red-600">
                                                <span>Exam Late Fine</span>
                                                <span className="font-medium">{formatCurrency(examLateFines)}</span>
                                            </div>
                                        )}
                                        {annualTotal > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">Annual Charges</span>
                                                <span className="font-medium">{formatCurrency(annualTotal)}</span>
                                            </div>
                                        )}
                                        {oneTimeTotal > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-gray-600">One-Time Charges</span>
                                                <span className="font-medium">{formatCurrency(oneTimeTotal)}</span>
                                            </div>
                                        )}

                                        <div className="pt-2 border-t border-gray-100 flex justify-between font-semibold">
                                            <span>Subtotal</span>
                                            <span>{formatCurrency(subtotal)}</span>
                                        </div>
                                    </div>

                                    {/* Concession */}
                                    <div className="mt-4 space-y-2">
                                        <Input
                                            label="Concession (₹)"
                                            type="number"
                                            min={0}
                                            max={subtotal}
                                            value={concession || ''}
                                            onChange={(e) => setConcession(Number(e.target.value) || 0)}
                                        />
                                        {concession > 0 && (
                                            <Input
                                                label="Concession Reason"
                                                placeholder="e.g. Sibling discount..."
                                                value={concessionReason}
                                                onChange={(e) => setConcessionReason(e.target.value)}
                                            />
                                        )}
                                    </div>

                                    {/* Net Payable */}
                                    <div className="mt-4 p-4 bg-[#1E3A5F] rounded-xl text-white">
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium">NET PAYABLE</span>
                                            <span className="text-xl font-bold">{formatCurrency(netPayable)}</span>
                                        </div>
                                    </div>

                                    {/* Payment Mode */}
                                    <div className="mt-4 space-y-3">
                                        <label className="text-sm font-medium text-gray-700">Payment Mode</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(['cash', 'upi', 'cheque', 'bank_transfer'] as PaymentMode[]).map((mode) => (
                                                <button
                                                    key={mode}
                                                    onClick={() => setPaymentMode(mode)}
                                                    className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all ${paymentMode === mode ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#1E3A5F]'}`}
                                                >
                                                    {mode === 'cash' ? '💵 Cash' : mode === 'upi' ? '📱 UPI' : mode === 'cheque' ? '🏦 Cheque' : '🏛️ Bank Transfer'}
                                                </button>
                                            ))}
                                        </div>

                                        {paymentMode === 'upi' && (
                                            <Input label="UPI Transaction ID" placeholder="Enter UPI Txn ID..." value={upiTxnId} onChange={(e) => setUpiTxnId(e.target.value)} />
                                        )}
                                        {paymentMode === 'cheque' && (
                                            <Input label="Cheque Number" placeholder="Enter cheque number..." value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} />
                                        )}

                                        <Input label="Payment Date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                                        <Input label="Notes (optional)" placeholder="Any additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                                    </div>

                                    {/* Action buttons */}
                                    <div className="mt-4 space-y-2">
                                        <Button
                                            variant="secondary"
                                            className="w-full"
                                            disabled={!hasAnySelected || netPayable <= 0}
                                            onClick={() => setShowPreview(true)}
                                        >
                                            👀 Preview Receipt
                                        </Button>
                                        <Button
                                            className="w-full"
                                            disabled={!hasAnySelected || netPayable <= 0}
                                            loading={collectMutation.isPending}
                                            onClick={() => setShowPreview(true)}
                                        >
                                            ✅ Collect Fee — {formatCurrency(netPayable)}
                                        </Button>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Preview Modal */}
            <Modal isOpen={showPreview} onClose={() => setShowPreview(false)} title="Receipt Preview" size="lg">
                <div className="space-y-4">
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                        <div className="flex justify-between font-semibold text-gray-700">
                            <span>Student</span>
                            <span>{selectedStudent?.first_name} {selectedStudent?.last_name}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Class</span>
                            <span>{selectedStudent?.section.class.name}-{selectedStudent?.section.name}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Payment Mode</span>
                            <span className="uppercase">{paymentMode}</span>
                        </div>
                        <div className="flex justify-between text-gray-600">
                            <span>Date</span>
                            <span>{formatDate(paymentDate)}</span>
                        </div>
                        <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-base">
                            <span>Total Payable</span>
                            <span className="text-[#1E3A5F]">{formatCurrency(netPayable)}</span>
                        </div>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                        ⚠️ Please verify all details before confirming. This action cannot be undone without admin cancellation.
                    </div>

                    <div className="flex gap-3">
                        <Button variant="secondary" className="flex-1" onClick={() => setShowPreview(false)}>
                            ← Back to Edit
                        </Button>
                        <Button
                            className="flex-1"
                            loading={collectMutation.isPending}
                            onClick={() => collectMutation.mutate()}
                        >
                            Confirm & Collect ✓
                        </Button>
                    </div>
                </div>
            </Modal>
        </AppLayout>
    );
}
