import React from 'react';

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
    return (
        <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />
    );
}

export function PageSkeleton() {
    return (
        <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-8 w-32" />
                    </div>
                ))}
            </div>
            {/* Chart placeholders */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <Skeleton className="h-4 w-40 mb-4" />
                    <Skeleton className="h-64 w-full" />
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <Skeleton className="h-4 w-40 mb-4" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
            {/* Table placeholder */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
                <Skeleton className="h-4 w-32 mb-4" />
                {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                ))}
            </div>
        </div>
    );
}
