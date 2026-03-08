import React from 'react';

type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'info' | 'purple';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    size?: BadgeSize;
    className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-emerald-100 text-emerald-700',
    danger: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
};

export function Badge({ children, variant = 'default', size = 'md', className = '' }: BadgeProps) {
    return (
        <span className={`inline-flex items-center font-medium rounded-full ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}>
            {children}
        </span>
    );
}
