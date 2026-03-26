'use client';

import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Header } from '@/components/layout/header';
import { DataTable } from '@/components/tables/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import type { StudentListItem } from '@/types';
import Image from 'next/image';
import Link from 'next/link';

export default function StudentsPage() {
    const params = useParams();
    const router = useRouter();
    const { hasPermission } = useAuth();
    const schoolId = params.schoolId as string;

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [classFilter, setClassFilter] = useState('');
    const [sectionFilter, setSectionFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');
    const [transportFilter, setTransportFilter] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Debounce search
    const handleSearch = useCallback((value: string) => {
        setSearch(value);
        clearTimeout((window as unknown as { searchTimer?: number }).searchTimer);
        (window as unknown as { searchTimer?: number }).searchTimer = window.setTimeout(() => {
            setDebouncedSearch(value);
            setPage(1);
        }, 300);
    }, []);

    const { data: classesData } = useQuery({
        queryKey: ['classes', schoolId],
        queryFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/classes`);
            return res.json();
        },
    });

    const { data: sectionsData } = useQuery({
        queryKey: ['sections', schoolId, classFilter],
        queryFn: async () => {
            if (!classFilter) return { data: [] };
            const res = await fetch(`/api/schools/${schoolId}/classes/${classFilter}/sections`);
            return res.json();
        },
        enabled: !!classFilter,
    });

    const { data, isLoading } = useQuery({
        queryKey: ['students', schoolId, debouncedSearch, classFilter, sectionFilter, statusFilter, transportFilter, page, pageSize],
        queryFn: async () => {
            const params = new URLSearchParams({
                search: debouncedSearch,
                classId: classFilter,
                sectionId: sectionFilter,
                isActive: statusFilter === 'active' ? 'true' : statusFilter === 'inactive' ? 'false' : '',
                transportEnrolled: transportFilter,
                page: String(page),
                pageSize: String(pageSize),
            });
            const res = await fetch(`/api/schools/${schoolId}/students?${params}`);
            if (!res.ok) throw new Error('Failed to fetch students');
            return res.json();
        },
        keepPreviousData: true,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const handleExportCSV = async () => {
        const params = new URLSearchParams({ search: debouncedSearch, classId: classFilter, sectionId: sectionFilter, isActive: statusFilter === 'active' ? 'true' : statusFilter === 'inactive' ? 'false' : '', format: 'csv' });
        const res = await fetch(`/api/schools/${schoolId}/students?${params}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'students.csv';
        a.click();
    };

    const classOptions = React.useMemo(() => [
        { value: '', label: 'All Classes' },
        ...((classesData?.data || []).map((c: { id: string; name: string }) => ({ value: c.id, label: c.name }))),
    ], [classesData]);

    const sectionOptions = React.useMemo(() => [
        { value: '', label: 'All Sections' },
        ...((sectionsData?.data || []).map((s: { id: string; name: string }) => ({ value: s.id, label: s.name }))),
    ], [sectionsData]);

    const columns = [
        {
            key: 'photo',
            header: '',
            render: (student: StudentListItem) => (
                <div className="w-9 h-9 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center text-[#1E3A5F] font-bold text-sm">
                    {student.photo_url ? (
                        <Image src={student.photo_url} alt={student.first_name} width={36} height={36} className="object-cover" />
                    ) : (
                        `${student.first_name[0]}${student.last_name[0]}`
                    )}
                </div>
            ),
            className: 'w-14',
        },
        {
            key: 'admission_no',
            header: 'Adm No',
            sortable: true,
            render: (s: StudentListItem) => (
                <span className="font-mono text-xs text-[#1E3A5F] font-semibold">{s.admission_no}</span>
            ),
        },
        {
            key: 'name',
            header: 'Student Name',
            sortable: true,
            render: (s: StudentListItem) => (
                <span className="font-medium text-gray-900">{s.first_name} {s.last_name}</span>
            ),
        },
        {
            key: 'class',
            header: 'Class',
            render: (s: StudentListItem) => (
                <span>{s.section.class.name} - {s.section.name}</span>
            ),
        },
        {
            key: 'parent',
            header: 'Parent',
            render: (s: StudentListItem) => (
                <div>
                    <p className="text-sm text-gray-700">{s.parent_name}</p>
                    <p className="text-xs text-gray-400">{s.parent_phone}</p>
                </div>
            ),
        },
        {
            key: 'transport',
            header: 'Transport',
            render: (s: StudentListItem) => s.transport_enrollment ? (
                <Badge variant="info" size="sm">🚌 {s.transport_enrollment.route.route_name.split('-')[0].trim()}</Badge>
            ) : (
                <span className="text-xs text-gray-400">—</span>
            ),
        },
        {
            key: 'status',
            header: 'Status',
            render: (s: StudentListItem) => (
                <Badge variant={s.is_active ? 'success' : 'danger'} size="sm">
                    {s.is_active ? 'Active' : 'Inactive'}
                </Badge>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            render: (s: StudentListItem) => (
                <div className="flex items-center gap-2">
                    <Link href={`/schools/${schoolId}/students/${s.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                    </Link>
                    <Link href={`/schools/${schoolId}/fees/collect?studentId=${s.id}`}>
                        <Button variant="success" size="sm">💰 Collect</Button>
                    </Link>
                </div>
            ),
        },
    ];

    return (
        <AppLayout>
            <Header
                title="Students"
                subtitle="Manage student records and fee collection"
                actions={
                    hasPermission(['super_admin', 'school_admin']) ? (
                        <Link href={`/schools/${schoolId}/students/new`}>
                            <Button>+ Add Student</Button>
                        </Link>
                    ) : undefined
                }
            />
            <div className="p-6 space-y-4">
                {/* Filters */}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-4">
                    <Select
                        options={classOptions}
                        value={classFilter}
                        onChange={(e) => { setClassFilter(e.target.value); setSectionFilter(''); setPage(1); }}
                        className="w-44"
                    />
                    {classFilter && (
                        <Select
                            options={sectionOptions}
                            value={sectionFilter}
                            onChange={(e) => { setSectionFilter(e.target.value); setPage(1); }}
                            className="w-36"
                        />
                    )}
                    <Select
                        options={[
                            { value: 'active', label: 'Active Students' },
                            { value: 'inactive', label: 'Inactive Students' },
                            { value: '', label: 'All Students' },
                        ]}
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                        className="w-44"
                    />
                    <Select
                        options={[
                            { value: '', label: 'All Transport' },
                            { value: 'true', label: 'Transport Enrolled' },
                            { value: 'false', label: 'No Transport' },
                        ]}
                        value={transportFilter}
                        onChange={(e) => { setTransportFilter(e.target.value); setPage(1); }}
                        className="w-44"
                    />
                    <Button variant="secondary" size="sm" onClick={handleExportCSV}>
                        ⬇ Export CSV
                    </Button>
                </div>

                <DataTable
                    data={data?.data || []}
                    columns={columns}
                    loading={isLoading}
                    searchPlaceholder="Search by name, admission no, or parent phone..."
                    onSearch={handleSearch}
                    searchValue={search}
                    totalItems={data?.total}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                    emptyMessage="No students found. Try adjusting your filters."
                    emptyIcon="👨‍🎓"
                    onRowClick={(s) => router.push(`/schools/${schoolId}/students/${s.id}`)}
                    getRowId={(s) => s.id}
                />
            </div>
        </AppLayout>
    );
}
