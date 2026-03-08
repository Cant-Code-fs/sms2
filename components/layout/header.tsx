'use client';

import React from 'react';
import { getGreeting } from '@/lib/utils/formatDate';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/lib/utils/formatDate';

interface HeaderProps {
    title?: string;
    subtitle?: string;
    actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
    const { user } = useAuth();

    const displayTitle = title || `${getGreeting()}, ${user?.name?.split(' ')[0] || 'there'}!`;
    const displaySubtitle = subtitle || formatDate(new Date());

    return (
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-sm border-b border-gray-100 px-6 py-4 flex items-center justify-between">
            <div>
                <h1 className="text-xl font-bold text-gray-900">{displayTitle}</h1>
                {displaySubtitle && <p className="text-sm text-gray-500 mt-0.5">{displaySubtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
    );
}
