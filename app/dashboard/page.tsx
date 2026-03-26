'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { Header } from '@/components/layout/header';
import { Card, StatCard } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { CollectionBarChart } from '@/components/charts';
import { formatCurrency } from '@/lib/utils/formatCurrency';
import { formatDateTime } from '@/lib/utils/formatDate';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export default function SuperAdminDashboard() {
    const { user } = useAuth();

    const { data: stats, isLoading } = useQuery({
        queryKey: ['super-admin-dashboard'],
        queryFn: async () => {
            const res = await fetch('/api/dashboard/super-admin');
            if (!res.ok) throw new Error('Failed to fetch dashboard');
            return res.json();
        },
        staleTime: 5 * 60 * 1000, // keep dashboard stale for 5 min
        refetchOnWindowFocus: false,
    });

    if (isLoading) {
        return (
            <AppLayout>
                <Header />
                <div className="p-6">
                    <PageSkeleton />
                </div>
            </AppLayout>
        );
    }

    const dashboardData = stats?.data || {
        schools: [],
        monthlyCollection: [],
        recentPayments: [],
        topDefaulters: [],
    };

    return (
        <AppLayout>
            <Header />
            <div className="p-6 space-y-6">
                {/* School Stats Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {dashboardData.schools?.map((school: {
                        schoolId: string;
                        schoolName: string;
                        totalActiveStudents: number;
                        thisMonthCollection: number;
                        outstandingThisMonth: number;
                        overdueAmount: number;
                        defaulterCount: number;
                    }) => (
                        <Card key={school.schoolId} className="overflow-hidden">
                            <div className="gradient-primary p-4 -m-6 mb-4">
                                <h3 className="text-white font-bold text-lg">{school.schoolName}</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-6 pt-2">
                                <div className="text-center p-3 bg-blue-50 rounded-xl">
                                    <p className="text-2xl font-bold text-[#1E3A5F]">{school.totalActiveStudents}</p>
                                    <p className="text-xs text-gray-500 mt-1">Active Students</p>
                                </div>
                                <div className="text-center p-3 bg-emerald-50 rounded-xl">
                                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(school.thisMonthCollection || 0)}</p>
                                    <p className="text-xs text-gray-500 mt-1">This Month</p>
                                </div>
                                <div className="text-center p-3 bg-amber-50 rounded-xl">
                                    <p className="text-2xl font-bold text-amber-600">{formatCurrency(school.outstandingThisMonth || 0)}</p>
                                    <p className="text-xs text-gray-500 mt-1">Outstanding</p>
                                </div>
                                <div className="text-center p-3 bg-red-50 rounded-xl">
                                    <p className="text-2xl font-bold text-red-600">{school.defaulterCount || 0}</p>
                                    <p className="text-xs text-gray-500 mt-1">Defaulters</p>
                                </div>
                            </div>
                            <Link href={`/schools/${school.schoolId}/dashboard`}>
                                <Button variant="outline" size="sm" className="w-full mt-4">
                                    Open {school.schoolName} →
                                </Button>
                            </Link>
                        </Card>
                    ))}
                </div>

                {/* Monthly Collection Chart */}
                <Card>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Monthly Collection Trend</h3>
                    <CollectionBarChart
                        data={dashboardData.monthlyCollection || []}
                        school1Name={dashboardData.schools?.[0]?.schoolName || 'School 1'}
                        school2Name={dashboardData.schools?.[1]?.schoolName || 'School 2'}
                    />
                </Card>

                {/* Recent Payments */}
                <Card>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Payments</h3>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>School</th>
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
                                {(dashboardData.recentPayments || []).length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="text-center py-8 text-gray-400">
                                            No recent payments
                                        </td>
                                    </tr>
                                ) : (
                                    dashboardData.recentPayments.map((payment: {
                                        id: string;
                                        schoolName: string;
                                        studentName: string;
                                        className: string;
                                        amount: number;
                                        lateFine: number;
                                        paymentMode: string;
                                        paymentDate: string;
                                        receiptNumber: string;
                                    }) => (
                                        <tr key={payment.id}>
                                            <td>
                                                <Badge variant="info" size="sm">{payment.schoolName}</Badge>
                                            </td>
                                            <td className="font-medium">{payment.studentName}</td>
                                            <td>{payment.className}</td>
                                            <td className="font-semibold">{formatCurrency(payment.amount)}</td>
                                            <td className={payment.lateFine > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                                                {formatCurrency(payment.lateFine)}
                                            </td>
                                            <td>
                                                <Badge variant="default" size="sm">
                                                    {payment.paymentMode.toUpperCase()}
                                                </Badge>
                                            </td>
                                            <td className="text-gray-500 text-xs">{formatDateTime(payment.paymentDate)}</td>
                                            <td className="text-[#1E3A5F] font-mono text-xs">{payment.receiptNumber}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Top Defaulters */}
                <Card>
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Top 10 Defaulters</h3>
                    <div className="overflow-x-auto">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>School</th>
                                    <th>Class</th>
                                    <th>Total Outstanding</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(dashboardData.topDefaulters || []).length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-gray-400">
                                            No defaulters — Great! 🎉
                                        </td>
                                    </tr>
                                ) : (
                                    dashboardData.topDefaulters.map((d: {
                                        studentId: string;
                                        studentName: string;
                                        schoolName: string;
                                        className: string;
                                        totalOutstanding: number;
                                    }) => (
                                        <tr key={d.studentId}>
                                            <td className="font-medium">{d.studentName}</td>
                                            <td>{d.schoolName}</td>
                                            <td>{d.className}</td>
                                            <td className="text-red-600 font-bold">{formatCurrency(d.totalOutstanding)}</td>
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
