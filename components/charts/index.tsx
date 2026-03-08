'use client';

import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import { formatCurrency } from '@/lib/utils/formatCurrency';

const CHART_COLORS = {
    primary: '#1E3A5F',
    secondary: '#3B82F6',
    accent: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    purple: '#8B5CF6',
    pink: '#EC4899',
    teal: '#14B8A6',
};

const PIE_COLORS = [CHART_COLORS.primary, CHART_COLORS.accent, CHART_COLORS.warning, CHART_COLORS.danger, CHART_COLORS.purple, CHART_COLORS.pink, CHART_COLORS.teal];

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
    if (!active || !payload) return null;
    return (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-3">
            <p className="text-xs font-medium text-gray-500 mb-2">{label}</p>
            {payload.map((entry, i) => (
                <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
                    {entry.name}: {formatCurrency(entry.value)}
                </p>
            ))}
        </div>
    );
}

interface CollectionBarChartProps {
    data: Array<{ month: string; school1: number; school2: number }>;
    school1Name?: string;
    school2Name?: string;
}

export function CollectionBarChart({ data, school1Name = 'School 1', school2Name = 'School 2' }: CollectionBarChartProps) {
    return (
        <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="school1" name={school1Name} fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="school2" name={school2Name} fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} />
            </BarChart>
        </ResponsiveContainer>
    );
}

interface TrendLineChartProps {
    data: Array<{ month: string; amount: number }>;
    color?: string;
}

export function TrendLineChart({ data, color = CHART_COLORS.primary }: TrendLineChartProps) {
    return (
        <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="amount" stroke={color} strokeWidth={3} dot={{ r: 5, fill: color }} activeDot={{ r: 7 }} name="Collection" />
            </LineChart>
        </ResponsiveContainer>
    );
}

interface BreakdownPieChartProps {
    data: Array<{ name: string; value: number }>;
    donut?: boolean;
}

export function BreakdownPieChart({ data, donut = false }: BreakdownPieChartProps) {
    return (
        <ResponsiveContainer width="100%" height={280}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={donut ? 60 : 0}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                    {data.map((_, idx) => (
                        <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
        </ResponsiveContainer>
    );
}

interface ProgressBarProps {
    label: string;
    value: number;
    max: number;
    color?: string;
    showAmount?: boolean;
}

export function ProgressBar({ label, value, max, color = CHART_COLORS.primary, showAmount = true }: ProgressBarProps) {
    const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">{label}</span>
                <span className="text-xs text-gray-500">
                    {showAmount ? `${formatCurrency(value)} / ${formatCurrency(max)}` : `${percentage.toFixed(0)}%`}
                </span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
}
