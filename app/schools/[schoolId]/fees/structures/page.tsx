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
import toast from 'react-hot-toast';

interface FeeStructureItem {
    id: string;
    fee_type: { id: string; name: string; fee_category: string };
    class: { id: string; name: string; order: number };
    amount: number;
    academic_year: string;
    is_active: boolean;
}

interface FeeType {
    id: string;
    name: string;
    fee_category: string;
    is_active: boolean;
}

interface Class {
    id: string;
    name: string;
    order: number;
}

export default function FeeStructuresPage() {
    const params = useParams();
    const schoolId = params.schoolId as string;
    const queryClient = useQueryClient();

    const [addModal, setAddModal] = useState(false);
    const [form, setForm] = useState({ fee_type_id: '', class_id: '', amount: '' });

    const { data: schoolData } = useQuery({
        queryKey: ['school-info', schoolId],
        queryFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/info`);
            return res.json();
        },
    });

    const academicYear = schoolData?.data?.current_academic_year || '2024-25';

    const { data: feeTypesData } = useQuery({
        queryKey: ['fee-types', schoolId],
        queryFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/fees/types`);
            return res.json();
        },
    });

    const { data: classesData } = useQuery({
        queryKey: ['classes', schoolId],
        queryFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/classes`);
            return res.json();
        },
    });

    const { data: structuresData, isLoading } = useQuery({
        queryKey: ['fee-structures', schoolId, academicYear],
        queryFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/fees/structures?academicYear=${academicYear}`);
            return res.json();
        },
    });

    const addMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/fees/structures`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, amount: Number(form.amount), academic_year: academicYear }),
            });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
            return res.json();
        },
        onSuccess: () => {
            toast.success('Fee structure added');
            setAddModal(false);
            setForm({ fee_type_id: '', class_id: '', amount: '' });
            queryClient.invalidateQueries({ queryKey: ['fee-structures', schoolId] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    // Group structures by fee type
    const feeTypes: FeeType[] = (feeTypesData?.data || []).filter(
        (ft: FeeType) => ft.fee_category !== 'transport' && ft.is_active
    );
    const structures: FeeStructureItem[] = structuresData?.data || [];
    const classes: Class[] = (classesData?.data || []).sort((a: Class, b: Class) => a.order - b.order);

    // Find classes missing structure for a fee type
    const missingStructures: string[] = [];
    for (const ft of feeTypes) {
        for (const cls of classes) {
            const has = structures.some(s => s.fee_type.id === ft.id && s.class.id === cls.id);
            if (!has && ft.fee_category !== 'transport') {
                missingStructures.push(`${cls.name} has no ${ft.name} structure`);
            }
        }
    }

    const feeTypeOptions = feeTypes
        .filter(ft => ft.fee_category !== 'transport')
        .map(ft => ({ value: ft.id, label: `${ft.name} (${ft.fee_category})` }));

    const classOptions = classes.map(c => ({ value: c.id, label: c.name }));

    return (
        <AppLayout>
            <Header
                title="Fee Structures"
                subtitle={`Configure fee amounts by class — ${academicYear}`}
                actions={
                    <Button onClick={() => setAddModal(true)}>+ Add Structure</Button>
                }
            />
            <div className="p-6 space-y-4">
                {/* Warning banners for missing */}
                {missingStructures.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                        <p className="text-sm font-semibold text-amber-800 mb-2">⚠️ Missing Fee Structures</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                            {missingStructures.slice(0, 10).map((msg, i) => (
                                <p key={i} className="text-xs text-amber-700">• {msg} for {academicYear}</p>
                            ))}
                            {missingStructures.length > 10 && (
                                <p className="text-xs text-amber-600 font-medium">… and {missingStructures.length - 10} more</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Fee type sections */}
                {isLoading ? (
                    <div className="text-center py-12 text-gray-400">Loading structures...</div>
                ) : (
                    feeTypes.map((ft) => {
                        const ftStructures = structures.filter(s => s.fee_type.id === ft.id);
                        return (
                            <Card key={ft.id}>
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-base font-bold text-gray-900">{ft.name}</h3>
                                        <Badge
                                            variant={ft.fee_category === 'monthly' ? 'info' : ft.fee_category === 'examination' ? 'purple' : ft.fee_category === 'annual' ? 'warning' : 'default'}
                                            size="sm"
                                            className="mt-1"
                                        >
                                            {ft.fee_category.charAt(0).toUpperCase() + ft.fee_category.slice(1)}
                                        </Badge>
                                    </div>
                                    <span className="text-sm text-gray-400">{ftStructures.length} / {classes.length} classes configured</span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Class</th>
                                                <th>Amount</th>
                                                <th>Academic Year</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ftStructures.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="text-center py-6 text-gray-400 text-sm">
                                                        No structures defined. Click &quot;+ Add Structure&quot; to add amounts.
                                                    </td>
                                                </tr>
                                            ) : (
                                                ftStructures
                                                    .sort((a, b) => a.class.order - b.class.order)
                                                    .map(s => (
                                                        <tr key={s.id}>
                                                            <td className="font-medium">{s.class.name}</td>
                                                            <td className="font-semibold">{formatCurrency(s.amount)}</td>
                                                            <td>{s.academic_year}</td>
                                                            <td>
                                                                <Badge variant={s.is_active ? 'success' : 'danger'} size="sm">
                                                                    {s.is_active ? 'Active' : 'Inactive'}
                                                                </Badge>
                                                            </td>
                                                        </tr>
                                                    ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Add structure modal */}
            <Modal isOpen={addModal} onClose={() => setAddModal(false)} title="Add Fee Structure">
                <div className="space-y-4">
                    <Select
                        label="Fee Type"
                        options={[{ value: '', label: 'Select fee type' }, ...feeTypeOptions]}
                        value={form.fee_type_id}
                        onChange={e => setForm(p => ({ ...p, fee_type_id: e.target.value }))}
                        required
                    />
                    <Select
                        label="Class"
                        options={[{ value: '', label: 'Select class' }, ...classOptions]}
                        value={form.class_id}
                        onChange={e => setForm(p => ({ ...p, class_id: e.target.value }))}
                        required
                    />
                    <Input
                        label="Amount (₹)"
                        type="number"
                        min={0}
                        placeholder="e.g. 2000"
                        value={form.amount}
                        onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                        required
                    />
                    <div className="flex gap-3 pt-2">
                        <Button variant="secondary" className="flex-1" onClick={() => setAddModal(false)}>Cancel</Button>
                        <Button
                            className="flex-1"
                            disabled={!form.fee_type_id || !form.class_id || !form.amount}
                            loading={addMutation.isPending}
                            onClick={() => addMutation.mutate()}
                        >
                            Add Structure
                        </Button>
                    </div>
                </div>
            </Modal>
        </AppLayout>
    );
}
