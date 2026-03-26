'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';

import { AppLayout } from '@/components/layout/app-layout';
import { Header } from '@/components/layout/header';
import { DataTable } from '@/components/tables/data-table';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Skeleton, PageSkeleton } from '@/components/ui/skeleton';

type TeacherItem = {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    is_active: boolean;
    created_at: string; // ISO
};

type AddTeacherPayload = {
    name: string;
    email: string;
    phone?: string;
    role?: 'teacher';
};

export default function StaffSettingsPage() {
    const params = useParams();
    const schoolId = params.schoolId as string;
    const queryClient = useQueryClient();

    const [addModalOpen, setAddModalOpen] = useState(false);
    const [form, setForm] = useState<AddTeacherPayload>({ name: '', email: '', phone: '', role: 'teacher' });
    const [submitting, setSubmitting] = useState(false);

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ['teachers', schoolId],
        queryFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/staff/teachers`);
            if (!res.ok) throw new Error('Failed to fetch teachers');
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const teachers: TeacherItem[] = useMemo(() => {
        const d = data as { data?: TeacherItem[] } | undefined;
        return d?.data ?? [];
    }, [data]);

    const createTeacherMutation = useMutation({
        mutationFn: async () => {
            setSubmitting(true);
            const payload: AddTeacherPayload = {
                name: form.name.trim(),
                email: form.email.trim().toLowerCase(),
                phone: form.phone?.trim() || undefined,
                role: 'teacher',
            };

            if (!payload.name) throw new Error('Teacher name is required');
            if (!payload.email) throw new Error('Teacher email is required');

            const res = await fetch(`/api/schools/${schoolId}/staff/teachers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error || 'Failed to add teacher');
            }
            return res.json();
        },
        onSuccess: () => {
            setAddModalOpen(false);
            setForm({ name: '', email: '', phone: '', role: 'teacher' });
            queryClient.invalidateQueries({ queryKey: ['teachers', schoolId] });
            toast.success('Teacher added');
        },
        onError: (err: unknown) => {
            if (err && typeof err === 'object' && 'message' in err) {
                toast.error(String((err as { message?: unknown }).message) || 'Failed to add teacher');
            } else {
                toast.error('Failed to add teacher');
            }
        },
        onSettled: () => setSubmitting(false),
    });

    const columns = useMemo(
        () => [
            {
                key: 'name',
                header: 'Teacher Name',
                render: (t: TeacherItem) => <span className="font-medium text-gray-900">{t.name}</span>,
                sortable: true,
            },
            {
                key: 'email',
                header: 'Email',
                render: (t: TeacherItem) => <span className="text-xs text-gray-600">{t.email}</span>,
            },
            {
                key: 'phone',
                header: 'Phone',
                render: (t: TeacherItem) => <span className="text-xs text-gray-600">{t.phone || '—'}</span>,
            },
            {
                key: 'role',
                header: 'Role',
                render: (t: TeacherItem) => <Badge variant="info" size="sm">{t.role}</Badge>,
            },
            {
                key: 'status',
                header: 'Status',
                render: (t: TeacherItem) => (
                    <Badge variant={t.is_active ? 'success' : 'danger'} size="sm">
                        {t.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                ),
            },
        ],
        []
    );

    const closeAddModal = useCallback(() => {
        setAddModalOpen(false);
    }, []);

    return (
        <AppLayout>
            <Header
                title="Staff"
                subtitle="Manage teachers (add/update basic info)."
                actions={
                    <Button onClick={() => setAddModalOpen(true)}>
                        + Add Teacher
                    </Button>
                }
            />

            <div className="p-6 space-y-4">
                {isLoading && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <PageSkeleton />
                    </div>
                )}

                {!isLoading && (
                    <>
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between flex-wrap gap-3">
                            <Badge variant="default" size="sm">
                                Teachers: {teachers.length}
                            </Badge>
                            {isFetching && <span className="text-xs text-gray-400">Updating...</span>}
                        </div>

                        <DataTable
                            data={teachers}
                            columns={columns}
                            loading={isLoading}
                            emptyMessage="No teachers found. Add your first teacher."
                            emptyIcon="👥"
                            getRowId={(t) => t.id}
                            page={1}
                            pageSize={25}
                        />
                    </>
                )}
            </div>

            <Modal
                isOpen={addModalOpen}
                onClose={closeAddModal}
                title="Add Teacher"
                size="lg"
            >
                <div className="space-y-4">
                    <div className="text-sm text-gray-600">
                        A teacher login will be created in Supabase Auth, then saved in the Staff table.
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                            label="Teacher Name"
                            value={form.name}
                            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                            placeholder="e.g. Asha Verma"
                        />
                        <Input
                            label="Email"
                            value={form.email}
                            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                            placeholder="teacher@example.com"
                        />
                        <Input
                            label="Phone (optional)"
                            value={form.phone || ''}
                            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                            placeholder="+91..."
                        />
                        <Select
                            label="Role"
                            value={'teacher'}
                            options={[{ value: 'teacher', label: 'teacher' }]}
                            onChange={() => {}}
                            disabled
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                        <Button variant="ghost" onClick={closeAddModal} disabled={submitting || createTeacherMutation.isPending}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => createTeacherMutation.mutate()}
                            loading={createTeacherMutation.isPending}
                        >
                            Create Teacher
                        </Button>
                    </div>
                </div>
            </Modal>
        </AppLayout>
    );
}

