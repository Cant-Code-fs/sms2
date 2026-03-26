'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

import { AppLayout } from '@/components/layout/app-layout';
import { Header } from '@/components/layout/header';
import { DataTable } from '@/components/tables/data-table';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton, PageSkeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@/lib/utils/formatDate';
import toast from 'react-hot-toast';

type AttendanceStatus = 'present' | 'absent' | 'leave';

type TeacherAttendanceRow = {
    teacherId: string;
    teacherName: string;
    date: string; // YYYY-MM-DD
    status: AttendanceStatus | null;
    checkIn: string | null; // ISO
    checkOut: string | null; // ISO
};

type AttendanceQueryResponse = {
    success: boolean;
    data: TeacherAttendanceRow[];
};

type AttendanceReportRow = {
    id: string;
    teacherId: string;
    teacherName: string;
    date: string;
    status: AttendanceStatus;
    checkIn: string | null;
    checkOut: string | null;
};

function getISTDateString(d: Date) {
    // YYYY-MM-DD in Asia/Kolkata time.
    return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' });
}

function pad2(n: number) {
    return String(n).padStart(2, '0');
}

function toDateTimeLocalValue(iso: string) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function timeHHMM(d: Date) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function dateTimeLocalToIso(value: string) {
    if (!value) return null;
    // Input is interpreted in local timezone by JS Date parsing.
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString();
}

export default function TeacherAttendancePage() {
    const params = useParams();
    const schoolId = params.schoolId as string;
    const queryClient = useQueryClient();

    const todayStr = useMemo(() => getISTDateString(new Date()), []);

    const [dateMode, setDateMode] = useState<'today' | 'custom'>('today');
    const [customDateStr, setCustomDateStr] = useState(todayStr);
    const selectedDateStr = dateMode === 'today' ? todayStr : customDateStr;

    const {
        data: attendanceResp,
        isLoading: attendanceLoading,
        isFetching: attendanceFetching,
    } = useQuery({
        queryKey: ['teacher-attendance', schoolId, selectedDateStr],
        queryFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/attendance/teachers?date=${encodeURIComponent(selectedDateStr)}`);
            if (!res.ok) throw new Error('Failed to fetch teacher attendance');
            return res.json();
        },
        keepPreviousData: true,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const attendanceRows: TeacherAttendanceRow[] = useMemo(() => {
        const r = attendanceResp as AttendanceQueryResponse | undefined;
        return r?.data ?? [];
    }, [attendanceResp]);

    const [markModalOpen, setMarkModalOpen] = useState(false);

    const defaultCheckInLocal = useMemo(() => {
        // Auto-fill "now" time but on the selected date (local timezone).
        const now = new Date();
        return `${selectedDateStr}T${timeHHMM(now)}`;
    }, [selectedDateStr]);

    type DraftItem = { status: AttendanceStatus; checkInLocal: string; checkOutLocal: string };
    const [draftByTeacherId, setDraftByTeacherId] = useState<Record<string, DraftItem>>({});

    const openMarkModal = useCallback(() => {
        const next: Record<string, DraftItem> = {};
        for (const r of attendanceRows) {
            next[r.teacherId] = {
                status: (r.status ?? 'absent') as AttendanceStatus,
                checkInLocal: r.checkIn ? toDateTimeLocalValue(r.checkIn) : defaultCheckInLocal,
                checkOutLocal: r.checkOut ? toDateTimeLocalValue(r.checkOut) : '',
            };
        }
        setDraftByTeacherId(next);
        setMarkModalOpen(true);
    }, [attendanceRows, defaultCheckInLocal]);

    const closeMarkModal = useCallback(() => {
        setMarkModalOpen(false);
    }, []);

    const markAttendanceMutation = useMutation({
        mutationFn: async (payload: {
            date: string;
            items: Array<{
                teacherId: string;
                status: AttendanceStatus;
                checkIn: string | null;
                checkOut: string | null;
            }>;
        }) => {
            const res = await fetch(`/api/schools/${schoolId}/attendance/teachers/mark`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error || 'Failed to mark attendance');
            }
            return res.json();
        },
        onMutate: async (payload) => {
            // Optimistic update for instant UX.
            await queryClient.cancelQueries({ queryKey: ['teacher-attendance', schoolId, selectedDateStr] });

            const previous = queryClient.getQueryData<AttendanceQueryResponse>(['teacher-attendance', schoolId, selectedDateStr]);
            if (!previous?.data) return;

            const nextData: TeacherAttendanceRow[] = previous.data.map((row: TeacherAttendanceRow) => {
                const match = payload.items.find((i) => i.teacherId === row.teacherId);
                if (!match) return row;
                if (match.status !== 'present') {
                    return { ...row, status: match.status, checkIn: null, checkOut: null };
                }
                return {
                    ...row,
                    status: 'present',
                    checkIn: match.checkIn ?? null,
                    checkOut: match.checkOut ?? null,
                };
            });

            queryClient.setQueryData(['teacher-attendance', schoolId, selectedDateStr], {
                ...previous,
                data: nextData,
            });

            return { previous };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['teacher-attendance', schoolId, selectedDateStr] });
        },
        onError: (err: unknown, _payload: unknown, context: { previous?: AttendanceQueryResponse } | undefined) => {
            if (context?.previous) {
                queryClient.setQueryData(['teacher-attendance', schoolId, selectedDateStr], context.previous);
            }
            if (err && typeof err === 'object' && 'message' in err) {
                toast.error(String((err as { message?: unknown }).message) || 'Attendance update failed');
            } else {
                toast.error('Attendance update failed');
            }
        },
    });

    const submitBulkMark = useCallback(async () => {
        const items = attendanceRows.map((r) => {
            const d = draftByTeacherId[r.teacherId];
            const status = d?.status ?? 'absent';
            if (status !== 'present') {
                return { teacherId: r.teacherId, status, checkIn: null, checkOut: null };
            }
            return {
                teacherId: r.teacherId,
                status,
                checkIn: dateTimeLocalToIso(d?.checkInLocal ?? defaultCheckInLocal),
                checkOut: d?.checkOutLocal ? dateTimeLocalToIso(d.checkOutLocal) : null,
            };
        });

        toast.dismiss();
        const toastId = toast.loading('Saving attendance...');

        try {
            await markAttendanceMutation.mutateAsync({ date: selectedDateStr, items });
            toast.success('Attendance saved');
            toast.dismiss(toastId);
            closeMarkModal();
        } catch (e: unknown) {
            toast.dismiss(toastId);
            if (e && typeof e === 'object' && 'message' in e) {
                toast.error(String((e as { message?: unknown }).message) || 'Failed to save attendance');
            } else {
                toast.error('Failed to save attendance');
            }
        }
    }, [attendanceRows, draftByTeacherId, defaultCheckInLocal, selectedDateStr, markAttendanceMutation, closeMarkModal]);

    const markPresentQuick = useCallback(
        async (teacherId: string) => {
            const checkInIso = dateTimeLocalToIso(defaultCheckInLocal);
            if (!checkInIso) return;

            const payload = {
                date: selectedDateStr,
                items: [{ teacherId, status: 'present', checkIn: checkInIso, checkOut: null }],
            };
            try {
                await markAttendanceMutation.mutateAsync(payload);
            } catch (e: unknown) {
                if (e && typeof e === 'object' && 'message' in e) {
                    toast.error(String((e as { message?: unknown }).message) || 'Failed to mark present');
                } else {
                    toast.error('Failed to mark present');
                }
            }
        },
        [defaultCheckInLocal, markAttendanceMutation, selectedDateStr]
    );

    const statusBadge = useCallback((status: AttendanceStatus | null) => {
        if (!status) return <Badge variant="default" size="sm">—</Badge>;
        if (status === 'present') return <Badge variant="success" size="sm">Present</Badge>;
        if (status === 'leave') return <Badge variant="purple" size="sm">Leave</Badge>;
        return <Badge variant="danger" size="sm">Absent</Badge>;
    }, []);

    const teacherTableColumns = useMemo(
        () => [
            {
                key: 'teacher',
                header: 'Teacher Name',
                render: (r: TeacherAttendanceRow) => (
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center text-[#1E3A5F] font-bold text-xs">
                            {r.teacherName?.[0]?.toUpperCase() || 'T'}
                        </div>
                        <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{r.teacherName}</p>
                        </div>
                    </div>
                ),
            },
            {
                key: 'date',
                header: 'Date',
                render: (r: TeacherAttendanceRow) => <span className="font-mono text-xs text-gray-700">{r.date}</span>,
            },
            {
                key: 'status',
                header: 'Status',
                render: (r: TeacherAttendanceRow) => statusBadge(r.status),
            },
            {
                key: 'checkIn',
                header: 'Check In',
                render: (r: TeacherAttendanceRow) => r.checkIn ? (
                    <span className="text-xs text-gray-600">{formatDateTime(r.checkIn)}</span>
                ) : (
                    <span className="text-xs text-gray-300">—</span>
                ),
            },
            {
                key: 'checkOut',
                header: 'Check Out',
                render: (r: TeacherAttendanceRow) => r.checkOut ? (
                    <span className="text-xs text-gray-600">{formatDateTime(r.checkOut)}</span>
                ) : (
                    <span className="text-xs text-gray-300">—</span>
                ),
            },
            {
                key: 'quick',
                header: '',
                className: 'w-40',
                render: (r: TeacherAttendanceRow) => (
                    <Button size="sm" variant="success" onClick={() => markPresentQuick(r.teacherId)}>
                        Mark Present
                    </Button>
                ),
            },
        ],
        [markPresentQuick, statusBadge]
    );

    // Reports filters
    const [reportDateFrom, setReportDateFrom] = useState(selectedDateStr);
    const [reportDateTo, setReportDateTo] = useState(selectedDateStr);
    const [reportTeacherId, setReportTeacherId] = useState('');
    const [reportStatus, setReportStatus] = useState('');

    const reportTeachersOptions = useMemo(() => {
        return [
            { value: '', label: 'All Teachers' },
            ...attendanceRows.map((r) => ({ value: r.teacherId, label: r.teacherName })),
        ];
    }, [attendanceRows]);

    const reportStatusOptions = useMemo(
        () => [
            { value: '', label: 'All Statuses' },
            { value: 'present', label: 'Present' },
            { value: 'absent', label: 'Absent' },
            { value: 'leave', label: 'Leave' },
        ],
        []
    );

    const {
        data: reportsResp,
        isLoading: reportsLoading,
    } = useQuery({
        queryKey: [
            'teacher-attendance-reports',
            schoolId,
            reportDateFrom,
            reportDateTo,
            reportTeacherId,
            reportStatus,
        ],
        queryFn: async () => {
            const params = new URLSearchParams({
                dateFrom: reportDateFrom,
                dateTo: reportDateTo,
            });
            if (reportTeacherId) params.set('teacherId', reportTeacherId);
            if (reportStatus) params.set('status', reportStatus);

            const res = await fetch(`/api/schools/${schoolId}/attendance/reports?${params.toString()}`);
            if (!res.ok) throw new Error('Failed to fetch reports');
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        enabled: !!reportDateFrom && !!reportDateTo,
    });

    const reportRows: AttendanceReportRow[] = reportsResp?.data ?? [];

    const reportColumns = useMemo(
        () => [
            {
                key: 'teacherName',
                header: 'Teacher Name',
                render: (r: AttendanceReportRow) => <span className="font-medium text-gray-900">{r.teacherName}</span>,
            },
            {
                key: 'date',
                header: 'Date',
                render: (r: AttendanceReportRow) => <span className="font-mono text-xs text-gray-700">{r.date}</span>,
            },
            {
                key: 'status',
                header: 'Status',
                render: (r: AttendanceReportRow) => statusBadge(r.status),
            },
            {
                key: 'checkIn',
                header: 'Check In',
                render: (r: AttendanceReportRow) => r.checkIn ? (
                    <span className="text-xs text-gray-600">{formatDateTime(r.checkIn)}</span>
                ) : (
                    <span className="text-xs text-gray-300">—</span>
                ),
            },
            {
                key: 'checkOut',
                header: 'Check Out',
                render: (r: AttendanceReportRow) => r.checkOut ? (
                    <span className="text-xs text-gray-600">{formatDateTime(r.checkOut)}</span>
                ) : (
                    <span className="text-xs text-gray-300">—</span>
                ),
            },
        ],
        [statusBadge]
    );

    return (
        <AppLayout>
            <Header
                title="Teacher Attendance"
                subtitle="Mark attendance quickly, bulk-save, and generate reports."
                actions={
                    <div className="flex items-center gap-2">
                        <Button variant="secondary" onClick={() => setDateMode('today')} disabled={dateMode === 'today'}>
                            Today
                        </Button>
                        <Button variant="secondary" onClick={() => setDateMode('custom')} disabled={dateMode === 'custom'}>
                            Custom Date
                        </Button>
                        <Button onClick={openMarkModal} loading={attendanceLoading}>
                            Mark Attendance
                        </Button>
                    </div>
                }
            />

            <div className="p-6 space-y-6">
                {attendanceLoading && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-6">
                        <PageSkeleton />
                    </div>
                )}

                {!attendanceLoading && (
                    <>
                        <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-end gap-4">
                            {dateMode === 'custom' && (
                                <Input
                                    label="Select Date"
                                    type="date"
                                    value={customDateStr}
                                    onChange={(e) => setCustomDateStr(e.target.value)}
                                    className="w-44"
                                />
                            )}
                            <div className="flex-1" />
                            <div className="flex items-center gap-2">
                                <Badge variant="info" size="sm">
                                    Date: {selectedDateStr}
                                </Badge>
                                {attendanceFetching && (
                                    <span className="text-xs text-gray-400">Updating...</span>
                                )}
                            </div>
                        </div>

                        <DataTable
                            data={attendanceRows}
                            columns={teacherTableColumns}
                            loading={attendanceLoading}
                            emptyMessage="No teachers found for attendance."
                            emptyIcon="🗓️"
                            getRowId={(r) => r.teacherId}
                        />

                        {/* Reports */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <h2 className="text-lg font-bold text-gray-900">Reports</h2>
                                <span className="text-sm text-gray-500">
                                    Filter by date range, teacher, and status.
                                </span>
                            </div>

                            <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-4 items-end">
                                <Input
                                    label="From"
                                    type="date"
                                    value={reportDateFrom}
                                    onChange={(e) => setReportDateFrom(e.target.value)}
                                    className="w-44"
                                />
                                <Input
                                    label="To"
                                    type="date"
                                    value={reportDateTo}
                                    onChange={(e) => setReportDateTo(e.target.value)}
                                    className="w-44"
                                />
                                <Select
                                    label="Teacher"
                                    options={reportTeachersOptions}
                                    value={reportTeacherId}
                                    onChange={(e) => setReportTeacherId(e.target.value)}
                                    className="w-56"
                                />
                                <Select
                                    label="Status"
                                    options={reportStatusOptions}
                                    value={reportStatus}
                                    onChange={(e) => setReportStatus(e.target.value)}
                                    className="w-48"
                                />
                            </div>

                            <DataTable
                                data={reportRows}
                                columns={reportColumns}
                                loading={reportsLoading}
                                emptyMessage="No attendance records match these filters."
                                emptyIcon="📈"
                                getRowId={(r) => r.id}
                                page={1}
                                pageSize={25}
                            />
                        </div>
                    </>
                )}
            </div>

            <Modal
                isOpen={markModalOpen}
                onClose={closeMarkModal}
                title={`Mark Attendance - ${selectedDateStr}`}
                size="xl"
            >
                {attendanceLoading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-10 w-64" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 flex flex-wrap gap-3 items-center justify-between">
                            <div className="text-sm text-gray-700">
                                Bulk update for all teachers on <span className="font-semibold">{selectedDateStr}</span>
                            </div>
                            <div className="text-xs text-gray-500">
                                Check-in is auto-filled for <span className="font-medium">Present</span>. Check-out is optional.
                            </div>
                        </div>

                        <div className="space-y-3">
                            {attendanceRows.length === 0 ? (
                                <div className="text-sm text-gray-500">
                                    No teachers available to mark attendance.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {attendanceRows.map((t) => {
                                        const d = draftByTeacherId[t.teacherId];
                                        const status = d?.status ?? 'absent';
                                        return (
                                            <div key={t.teacherId} className="bg-white rounded-2xl border border-gray-100 p-3">
                                                <div className="flex items-start gap-3">
                                                    <div className="w-40 min-w-[160px]">
                                                        <p className="font-medium text-gray-900">{t.teacherName}</p>
                                                    </div>
                                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                                                        <Select
                                                            label="Status"
                                                            options={[
                                                                { value: 'present', label: 'Present' },
                                                                { value: 'absent', label: 'Absent' },
                                                                { value: 'leave', label: 'Leave' },
                                                            ]}
                                                            value={status}
                                                            onChange={(e) => {
                                                                const nextStatus = e.target.value as AttendanceStatus;
                                                                setDraftByTeacherId((prev) => {
                                                                    const prevItem = prev[t.teacherId] ?? {
                                                                        status: 'absent',
                                                                        checkInLocal: defaultCheckInLocal,
                                                                        checkOutLocal: '',
                                                                    };
                                                                    const nextItem: DraftItem = {
                                                                        ...prevItem,
                                                                        status: nextStatus,
                                                                        checkInLocal: nextStatus === 'present' ? (prevItem.checkInLocal || defaultCheckInLocal) : prevItem.checkInLocal,
                                                                    };
                                                                    if (nextStatus !== 'present') {
                                                                        nextItem.checkOutLocal = '';
                                                                    }
                                                                    return { ...prev, [t.teacherId]: nextItem };
                                                                });
                                                            }}
                                                        />

                                                        <Input
                                                            label="Check In"
                                                            type="datetime-local"
                                                            value={d?.checkInLocal ?? defaultCheckInLocal}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setDraftByTeacherId((prev) => ({
                                                                    ...prev,
                                                                    [t.teacherId]: {
                                                                        status,
                                                                        checkInLocal: v,
                                                                        checkOutLocal: prev[t.teacherId]?.checkOutLocal ?? '',
                                                                    },
                                                                }));
                                                            }}
                                                            disabled={status !== 'present'}
                                                        />

                                                        <Input
                                                            label="Check Out (optional)"
                                                            type="datetime-local"
                                                            value={d?.checkOutLocal ?? ''}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setDraftByTeacherId((prev) => ({
                                                                    ...prev,
                                                                    [t.teacherId]: {
                                                                        status,
                                                                        checkInLocal: prev[t.teacherId]?.checkInLocal ?? defaultCheckInLocal,
                                                                        checkOutLocal: v,
                                                                    },
                                                                }));
                                                            }}
                                                            disabled={status !== 'present'}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                            <Button variant="ghost" onClick={closeMarkModal} disabled={markAttendanceMutation.isPending}>
                                Cancel
                            </Button>
                            <Button onClick={submitBulkMark} loading={markAttendanceMutation.isPending}>
                                Save Attendance
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </AppLayout>
    );
}

