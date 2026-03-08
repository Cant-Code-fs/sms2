import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps) {
    return (
        <div
            className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`}
            onClick={onClick}
        >
            {children}
        </div>
    );
}

interface StatCardProps {
    title: string;
    value: string;
    icon?: React.ReactNode;
    change?: { value: string; positive: boolean };
    className?: string;
}

export function StatCard({ title, value, icon, change, className = '' }: StatCardProps) {
    return (
        <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">{title}</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1 truncate">{value}</p>
                    {change && (
                        <p className={`text-xs mt-1 font-medium ${change.positive ? 'text-emerald-600' : 'text-red-500'}`}>
                            {change.positive ? '↑' : '↓'} {change.value}
                        </p>
                    )}
                </div>
                {icon && (
                    <div className="w-10 h-10 bg-[#1E3A5F]/10 rounded-xl flex items-center justify-center text-[#1E3A5F] shrink-0">
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );
}
