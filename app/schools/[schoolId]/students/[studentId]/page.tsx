'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageSkeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatDate, formatDateTime } from '@/lib/utils/formatDate';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import Image from 'next/image';
import Link from 'next/link';

export default function StudentProfilePage() {
    const params = useParams();
    const router = useRouter();
    const { hasPermission } = useAuth();
    const queryClient = useQueryClient();
    const schoolId = params.schoolId as string;
    const studentId = params.studentId as string;

    const [deactivateModal, setDeactivateModal] = useState(false);
    const [enrollModal, setEnrollModal] = useState(false);
    const [selectedRouteId, setSelectedRouteId] = useState('');
    const [enrollDate, setEnrollDate] = useState(new Date().toISOString().split('T')[0]);

    const { data, isLoading } = useQuery({
        queryKey: ['student-profile', studentId],
        queryFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/students/${studentId}/profile`);
            if (!res.ok) throw new Error('Failed to fetch student');
            return res.json();
        },
    });

    const { data: routesData } = useQuery({
        queryKey: ['transport-routes', schoolId],
        queryFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/fees/transport`);
            return res.json();
        },
    });

    const { data: duesData } = useQuery({
        queryKey: ['student-dues', schoolId, studentId],
        queryFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/fees/dues/${studentId}`);
            return res.json();
        },
    });

    const deactivateMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/students/${studentId}/deactivate`, {
                method: 'POST',
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Student deactivated');
            setDeactivateModal(false);
            queryClient.invalidateQueries({ queryKey: ['student-profile', studentId] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const enrollMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/students/${studentId}/transport`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ route_id: selectedRouteId, start_date: enrollDate }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Transport enrollment updated');
            setEnrollModal(false);
            queryClient.invalidateQueries({ queryKey: ['student-profile', studentId] });
            queryClient.invalidateQueries({ queryKey: ['student-dues', schoolId, studentId] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    const unenrollMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/students/${studentId}/transport`, {
                method: 'DELETE',
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Transport unenrolled');
            queryClient.invalidateQueries({ queryKey: ['student-profile', studentId] });
            queryClient.invalidateQueries({ queryKey: ['student-dues', schoolId, studentId] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    if (isLoading) {
        return <AppLayout><Header /><div className="p-6"><PageSkeleton /></div></AppLayout>;
    }

    const student = data?.data;
    if (!student) return <AppLayout><Header /><div className="p-6 text-center py-20 text-gray-400">Student not found</div></AppLayout>;

    const dues = duesData?.data;
    const totalDues = dues ? [
        ...dues.monthly.reduce((s: number, m: { amount: number; lateFine: number }) => s + m.amount + m.lateFine, 0),
        ...dues.transport.reduce((s: number, t: { amount: number; lateFine: number }) => s + t.amount + t.lateFine, 0),
        ...dues.examination.reduce((s: number, e: { amount: number; lateFine: number }) => s + e.amount + e.lateFine, 0),
        ...dues.annual.reduce((s: number, a: { amount: number }) => s + a.amount, 0),
        ...dues.oneTime.reduce((s: number, o: { amount: number }) => s + o.amount, 0),
    ].reduce((a: number, b: number) => a + b, 0) : 0;

    // compute total due properly
    const computedTotalDue = dues ? (
        (dues.monthly || []).reduce((s: number, m: { amount: number; lateFine: number }) => s + m.amount + m.lateFine, 0) +
        (dues.transport || []).reduce((s: number, t: { amount: number; lateFine: number }) => s + t.amount + t.lateFine, 0) +
        (dues.examination || []).reduce((s: number, e: { amount: number; lateFine: number }) => s + e.amount + (e.lateFine || 0), 0) +
        (dues.annual || []).reduce((s: number, a: { amount: number }) => s + a.amount, 0) +
        (dues.oneTime || []).reduce((s: number, o: { amount: number }) => s + o.amount, 0)
    ) : 0;

    const canEditStudent = hasPermission(['super_admin', 'school_admin']);
    const routeOptions = (routesData?.data || []).map((r: { id: string; route_name: string; monthly_fee: number }) => ({
        value: r.id,
        label: `${r.route_name} — ${formatCurrency(r.monthly_fee)}/mo`,
    }));

    return (
        <AppLayout>
            <Header
                title={`${student.first_name} ${student.last_name}`}
                subtitle={`${student.admission_no} · ${student.section.class.name}-${student.section.name}`}
                actions={
                    <div className="flex gap-2">
                        <Link href={`/schools/${schoolId}/fees/collect?studentId=${studentId}`}>
                            <Button variant="success">💰 Collect Fee</Button>
                        </Link>
                        {canEditStudent && (
                            <>
                                <Link href={`/schools/${schoolId}/students/${studentId}/edit`}>
                                    <Button variant="secondary">✏️ Edit</Button>
                                </Link>
                                {student.is_active && (
                                    <Button variant="danger" onClick={() => setDeactivateModal(true)}>Deactivate</Button>
                                )}
                            </>
                        )}
                    </div>
                }
            />
            <div className="p-6 space-y-6">
                {/* Section 1: Student Info */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-1">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-blue-100 flex items-center justify-center mb-4">
                                {student.photo_url ? (
                                    <Image src={student.photo_url} alt="" width={96} height={96} className="object-cover" />
                                ) : (
                                    <span className="text-4xl font-bold text-[#1E3A5F]">
                                        {student.first_name[0]}{student.last_name[0]}
                                    </span>
                                )}
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">{student.first_name} {student.last_name}</h2>
                            <p className="text-gray-500 text-sm mt-1">{student.admission_no}</p>
                            <Badge variant={student.is_active ? 'success' : 'danger'} className="mt-2">
                                {student.is_active ? '✓ Active' : '✗ Inactive'}
                            </Badge>

                            <div className="w-full mt-4 pt-4 border-t border-gray-100 space-y-2 text-sm text-left">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Class</span>
                                    <span className="font-medium">{student.section.class.name}-{student.section.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">DOB</span>
                                    <span className="font-medium">{formatDate(student.date_of_birth)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Gender</span>
                                    <span className="font-medium capitalize">{student.gender}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Admitted</span>
                                    <span className="font-medium">{formatDate(student.admission_date)}</span>
                                </div>
                            </div>
                        </div>
                    </Card>

                    <Card className="lg:col-span-2">
                        <h3 className="text-base font-bold text-gray-900 mb-4">Parent & Contact Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Parent Name</p>
                                <p className="font-medium">{student.parent_name}</p>
                            </div>
                            <div>
                                <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Phone (WhatsApp)</p>
                                <a href={`https://wa.me/${student.parent_phone.replace('+', '')}`} className="font-medium text-green-600 hover:underline" target="_blank" rel="noreferrer">
                                    {student.parent_phone}
                                </a>
                            </div>
                            <div>
                                <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Email</p>
                                <p className="font-medium">{student.parent_email || '—'}</p>
                            </div>
                            <div>
                                <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Address</p>
                                <p className="font-medium text-gray-700">{student.address || '—'}</p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Section 2: Fee Overview */}
                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-gray-900">Fee Overview</h3>
                        <div className={`px-4 py-2 rounded-xl font-bold text-sm ${computedTotalDue > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {computedTotalDue > 0 ? `Outstanding: ${formatCurrency(computedTotalDue)}` : 'All fees paid ✓'}
                        </div>
                    </div>

                    {dues && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Monthly */}
                            <div className="bg-blue-50 rounded-xl p-4">
                                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">📅 Monthly Fees</p>
                                {(dues.monthly || []).length === 0 ? (
                                    <p className="text-sm text-blue-600">All months paid ✓</p>
                                ) : (
                                    <div className="space-y-1">
                                        {(dues.monthly as Array<{ feeTypeName: string; month: string; amount: number; lateFine: number }>).slice(0, 3).map((m, i) => (
                                            <div key={i} className="flex justify-between text-xs">
                                                <span className="text-blue-700">{m.feeTypeName} - {m.month}</span>
                                                <span className="font-semibold text-blue-900">{formatCurrency(m.amount + m.lateFine)}</span>
                                            </div>
                                        ))}
                                        {dues.monthly.length > 3 && (
                                            <p className="text-xs text-blue-500">+ {dues.monthly.length - 3} more months</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Transport */}
                            <div className="bg-purple-50 rounded-xl p-4">
                                <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-2">🚌 Transport</p>
                                {!student.transport_enrollment ? (
                                    <p className="text-sm text-purple-600">Not enrolled</p>
                                ) : (dues.transport || []).length === 0 ? (
                                    <p className="text-sm text-purple-600">All months paid ✓</p>
                                ) : (
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-purple-700">{student.transport_enrollment.route.route_name}</p>
                                        {(dues.transport as Array<{ month: string; amount: number; lateFine: number }>).slice(0, 3).map((t, i) => (
                                            <div key={i} className="flex justify-between text-xs">
                                                <span className="text-purple-700">{t.month}</span>
                                                <span className="font-semibold text-purple-900">{formatCurrency(t.amount + t.lateFine)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Annual + Exam + One-time */}
                            <div className="bg-amber-50 rounded-xl p-4">
                                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">💼 Annual/Exam Charges</p>
                                {[...(dues.examination || []), ...(dues.annual || []), ...(dues.oneTime || [])].length === 0 ? (
                                    <p className="text-sm text-amber-600">All charges paid ✓</p>
                                ) : (
                                    <div className="space-y-1">
                                        {[...(dues.examination || []), ...(dues.annual || []), ...(dues.oneTime || [])].map((item: { feeTypeName: string; amount: number }, idx: number) => (
                                            <div key={idx} className="flex justify-between text-xs">
                                                <span className="text-amber-700">{item.feeTypeName}</span>
                                                <span className="font-semibold text-amber-900">{formatCurrency(item.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </Card>

                {/* Section 3: Payment History */}
                <Card>
                    <h3 className="text-base font-bold text-gray-900 mb-4">Payment History</h3>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Amount</th>
                                    <th>Late Fine</th>
                                    <th>Mode</th>
                                    <th>Receipt</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(student.receipts || []).length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">No payments yet</td></tr>
                                ) : (
                                    student.receipts.map((r: {
                                        id: string; payment_date: string; amount: number; late_fine: number;
                                        payment_mode: string; receipt_number: string; is_cancelled: boolean;
                                    }) => (
                                        <tr key={r.id} className={r.is_cancelled ? 'cancelled' : ''}>
                                            <td className="text-xs text-gray-500">{formatDateTime(r.payment_date)}</td>
                                            <td className="font-semibold">{formatCurrency(r.amount)}</td>
                                            <td className={r.late_fine > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                                                {formatCurrency(r.late_fine)}
                                            </td>
                                            <td><Badge variant="default" size="sm">{r.payment_mode.toUpperCase()}</Badge></td>
                                            <td className="font-mono text-xs text-[#1E3A5F] font-semibold">{r.receipt_number}</td>
                                            <td>
                                                <Badge variant={r.is_cancelled ? 'danger' : 'success'} size="sm">
                                                    {r.is_cancelled ? 'Cancelled' : 'Valid'}
                                                </Badge>
                                            </td>
                                            <td>
                                                {!r.is_cancelled && (
                                                    <a href={`/api/receipts/${r.id}/pdf`} target="_blank" rel="noreferrer">
                                                        <Button variant="ghost" size="sm">🖨️</Button>
                                                    </a>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Section 4: Transport Enrollment */}
                <Card>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-gray-900">Transport Enrollment</h3>
                        {canEditStudent && (
                            <div className="flex gap-2">
                                {student.transport_enrollment ? (
                                    <Button variant="danger" size="sm" loading={unenrollMutation.isPending} onClick={() => unenrollMutation.mutate()}>
                                        Unenroll
                                    </Button>
                                ) : (
                                    <Button size="sm" onClick={() => setEnrollModal(true)}>Enroll</Button>
                                )}
                            </div>
                        )}
                    </div>

                    {student.transport_enrollment ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-gray-500 text-xs uppercase mb-1">Route</p>
                                <p className="font-medium">{student.transport_enrollment.route.route_name}</p>
                            </div>
                            <div>
                                <p className="text-gray-500 text-xs uppercase mb-1">Monthly Fee</p>
                                <p className="font-semibold text-[#1E3A5F]">{formatCurrency(student.transport_enrollment.route.monthly_fee)}</p>
                            </div>
                            <div>
                                <p className="text-gray-500 text-xs uppercase mb-1">Start Date</p>
                                <p className="font-medium">{formatDate(student.transport_enrollment.start_date)}</p>
                            </div>
                            <div>
                                <p className="text-gray-500 text-xs uppercase mb-1">Status</p>
                                <Badge variant="success" size="sm">Active</Badge>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-400 text-sm">Not enrolled in transport</p>
                    )}
                </Card>
            </div>

            {/* Deactivate Modal */}
            <Modal isOpen={deactivateModal} onClose={() => setDeactivateModal(false)} title="Deactivate Student" size="sm">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">Are you sure you want to deactivate <strong>{student.first_name} {student.last_name}</strong>? They will no longer appear in active student lists.</p>
                    <div className="flex gap-3">
                        <Button variant="secondary" className="flex-1" onClick={() => setDeactivateModal(false)}>Cancel</Button>
                        <Button variant="danger" className="flex-1" loading={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate()}>
                            Deactivate
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Enroll Transport Modal */}
            <Modal isOpen={enrollModal} onClose={() => setEnrollModal(false)} title="Enroll in Transport">
                <div className="space-y-4">
                    <Select
                        label="Select Route"
                        options={[{ value: '', label: 'Select a route' }, ...routeOptions]}
                        value={selectedRouteId}
                        onChange={e => setSelectedRouteId(e.target.value)}
                        required
                    />
                    <Input label="Enrollment Start Date" type="date" value={enrollDate} onChange={e => setEnrollDate(e.target.value)} />
                    <div className="flex gap-3">
                        <Button variant="secondary" className="flex-1" onClick={() => setEnrollModal(false)}>Cancel</Button>
                        <Button className="flex-1" disabled={!selectedRouteId} loading={enrollMutation.isPending} onClick={() => enrollMutation.mutate()}>
                            Enroll
                        </Button>
                    </div>
                </div>
            </Modal>
        </AppLayout>
    );
}
