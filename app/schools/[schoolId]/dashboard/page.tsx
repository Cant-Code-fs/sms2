'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Header } from '@/components/layout/header';
import { Card, StatCard } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageSkeleton } from '@/components/ui/skeleton';
import { TrendLineChart, BreakdownPieChart, ProgressBar } from '@/components/charts';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatDateTime } from '@/lib/utils/formatDate';

export default function SchoolDashboard() {
    const params = useParams();
    const schoolId = params.schoolId as string;

    const { data, isLoading } = useQuery({
        queryKey: ['school-dashboard', schoolId],
        queryFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/dashboard`);
            if (!res.ok) throw new Error('Failed to fetch dashboard');
            return res.json();
        },
    });

    if (isLoading) {
        return (
            <AppLayout>
                <Header />
                <div className="p-6"><PageSkeleton /></div>
            </AppLayout>
        );
    }

    const d = data?.data || {};

    return (
        <AppLayout>
            <Header
                title={d.schoolName || 'School Dashboard'}
                subtitle={`Academic Year: ${d.academicYear || '2024-25'}`}
            />
            <div className="p-6 space-y-6">
                {/* Stat Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    <StatCard
                        title="Active Students"
                        value={String(d.stats?.totalActiveStudents || 0)}
                        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                    />
                    <StatCard
                        title="Today's Collection"
                        value={formatCurrency(d.stats?.todayCollection || 0)}
                        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    />
                    <StatCard
                        title="This Month"
                        value={formatCurrency(d.stats?.thisMonthCollection || 0)}
                        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                    />
                    <StatCard
                        title="Outstanding"
                        value={formatCurrency(d.stats?.outstandingThisMonth || 0)}
                        icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    />
                    <StatCard
                        title="Overdue"
                        value={formatCurrency(d.stats?.overdueAmount || 0)}
                        className={d.stats?.overdueAmount > 0 ? 'border-red-200' : ''}
                    />
                    <StatCard
                        title="Late Fines"
                        value={formatCurrency(d.stats?.lateFinesCollected || 0)}
                    />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Monthly trend */}
                    <Card>
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Monthly Collection Trend</h3>
                        <TrendLineChart data={d.monthlyTrend || []} />
                    </Card>

                    {/* Fee category breakdown */}
                    <Card>
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Fee Category Breakdown</h3>
                        <BreakdownPieChart data={d.categoryBreakdown || []} />
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Class-wise progress */}
                    <Card>
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Class-wise Collection Progress</h3>
                        <div className="space-y-4">
                            {(d.classProgress || []).map((cp: { classId: string; className: string; collected: number; expected: number }) => (
                                <ProgressBar
                                    key={cp.classId}
                                    label={cp.className}
                                    value={cp.collected}
                                    max={cp.expected}
                                    color={cp.collected >= cp.expected ? '#22C55E' : '#1E3A5F'}
                                />
                            ))}
                            {(d.classProgress || []).length === 0 && (
                                <p className="text-gray-400 text-sm text-center py-8">No data yet</p>
                            )}
                        </div>
                    </Card>

                    {/* Payment mode breakdown */}
                    <Card>
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Payment Mode Breakdown</h3>
                        <BreakdownPieChart data={d.modeBreakdown || []} donut />
                    </Card>
                </div>

                {/* Recent payments */}
                <Card>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Payments</h3>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Class</th>
                                    <th>Amount</th>
                                    <th>Late Fine</th>
                                    <th>Mode</th>
                                    <th>Date</th>
                                    <th>Receipt</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(d.recentPayments || []).length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">No recent payments</td></tr>
                                ) : (
                                    d.recentPayments.map((p: {
                                        id: string; studentName: string; className: string;
                                        amount: number; lateFine: number; paymentMode: string;
                                        paymentDate: string; receiptNumber: string;
                                    }) => (
                                        <tr key={p.id}>
                                            <td className="font-medium">{p.studentName}</td>
                                            <td>{p.className}</td>
                                            <td className="font-semibold">{formatCurrency(p.amount)}</td>
                                            <td className={p.lateFine > 0 ? 'text-red-600' : 'text-gray-400'}>{formatCurrency(p.lateFine)}</td>
                                            <td><Badge variant="default" size="sm">{p.paymentMode.toUpperCase()}</Badge></td>
                                            <td className="text-xs text-gray-500">{formatDateTime(p.paymentDate)}</td>
                                            <td className="font-mono text-xs text-[#1E3A5F]">{p.receiptNumber}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </AppLayout>
    );
}
