'use client';

import React, { useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

interface NavItem {
    label: string;
    href: string;
    icon: string;
    roles: string[];
    children?: NavItem[];
}

function buildNav(schoolId: string): NavItem[] {
    return [
        { label: 'Dashboard', href: `/schools/${schoolId}/dashboard`, icon: '📊', roles: ['super_admin', 'school_admin', 'accountant', 'receptionist'] },
        { label: 'Collect Fee', href: `/schools/${schoolId}/fees/collect`, icon: '💰', roles: ['super_admin', 'school_admin', 'accountant', 'receptionist'] },
        { label: 'Students', href: `/schools/${schoolId}/students`, icon: '👩‍🎓', roles: ['super_admin', 'school_admin', 'accountant', 'receptionist'] },
        { label: 'Receipts', href: `/schools/${schoolId}/receipts`, icon: '🧾', roles: ['super_admin', 'school_admin', 'accountant', 'receptionist'] },
        {
            label: 'Fee Setup', href: `/schools/${schoolId}/fees/structures`, icon: '📋', roles: ['super_admin', 'school_admin'],
            children: [
                { label: 'Structures', href: `/schools/${schoolId}/fees/structures`, icon: '📋', roles: ['super_admin', 'school_admin'] },
                { label: 'Fee Types', href: `/schools/${schoolId}/fees/types`, icon: '🏷️', roles: ['super_admin', 'school_admin'] },
                { label: 'Transport Routes', href: `/schools/${schoolId}/fees/transport`, icon: '🚌', roles: ['super_admin', 'school_admin'] },
                { label: 'Exam Terms', href: `/schools/${schoolId}/fees/exam-terms`, icon: '📝', roles: ['super_admin', 'school_admin'] },
            ],
        },
        {
            label: 'Reports', href: `/schools/${schoolId}/reports/daily`, icon: '📈', roles: ['super_admin', 'school_admin', 'accountant'],
            children: [
                { label: 'Daily Collection', href: `/schools/${schoolId}/reports/daily`, icon: '📅', roles: ['super_admin', 'school_admin', 'accountant'] },
                { label: 'Monthly Collection', href: `/schools/${schoolId}/reports/monthly`, icon: '📆', roles: ['super_admin', 'school_admin', 'accountant'] },
                { label: 'Outstanding Dues', href: `/schools/${schoolId}/reports/outstanding`, icon: '⚠️', roles: ['super_admin', 'school_admin', 'accountant'] },
                { label: 'Fee Summary', href: `/schools/${schoolId}/reports/fee-summary`, icon: '💼', roles: ['super_admin', 'school_admin', 'accountant'] },
                { label: 'Transport Report', href: `/schools/${schoolId}/reports/transport`, icon: '🚌', roles: ['super_admin', 'school_admin', 'accountant'] },
                { label: 'Cancelled Receipts', href: `/schools/${schoolId}/reports/cancelled-receipts`, icon: '❌', roles: ['super_admin', 'school_admin', 'accountant'] },
            ],
        },
        {
            label: 'Settings', href: `/schools/${schoolId}/settings/school`, icon: '⚙️', roles: ['super_admin', 'school_admin'],
            children: [
                { label: 'School Info', href: `/schools/${schoolId}/settings/school`, icon: '🏫', roles: ['super_admin', 'school_admin'] },
                { label: 'Classes', href: `/schools/${schoolId}/settings/classes`, icon: '📚', roles: ['super_admin', 'school_admin'] },
                { label: 'Staff', href: `/schools/${schoolId}/settings/staff`, icon: '👥', roles: ['super_admin', 'school_admin'] },
                { label: 'Academic Year', href: `/schools/${schoolId}/settings/academic-year`, icon: '📅', roles: ['super_admin', 'school_admin'] },
            ],
        },
    ];
}

function NavLink({ item }: { item: NavItem }) {
    const pathname = usePathname();
    const { hasPermission } = useAuth();
    const [open, setOpen] = useState(() => item.children?.some(c => pathname.startsWith(c.href)) ?? false);

    if (!hasPermission(item.roles as Parameters<typeof hasPermission>[0])) return null;

    const isActive = item.children
        ? item.children.some(c => pathname.startsWith(c.href))
        : pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

    if (item.children) {
        return (
            <div>
                <button
                    onClick={() => setOpen(!open)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
                >
                    <span className="text-base">{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                    <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {open && (
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/20 pl-3">
                        {item.children.map(child => <NavLink key={child.href} item={child} />)}
                    </div>
                )}
            </div>
        );
    }

    return (
        <Link
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-white/20 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
        >
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
        </Link>
    );
}

export function Sidebar() {
    const params = useParams();
    const { user, signOut, hasPermission } = useAuth();
    const schoolId = params?.schoolId as string | undefined;
    const navItems = schoolId ? buildNav(schoolId) : [];

    return (
        <div className="w-64 h-screen fixed left-0 top-0 gradient-primary flex flex-col z-30 overflow-y-auto scrollbar-thin">
            {/* Logo */}
            <div className="px-4 py-5 border-b border-white/20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl shrink-0">🏫</div>
                    <div className="min-w-0">
                        <h1 className="text-white font-bold text-sm leading-tight truncate">School Manager</h1>
                        <p className="text-white/50 text-xs">Fee Management System</p>
                    </div>
                </div>
            </div>

            {/* Super admin combined dashboard */}
            {user?.role === 'super_admin' && (
                <div className="px-3 pt-3">
                    <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all">
                        <span>🌐</span><span>Combined Dashboard</span>
                    </Link>
                </div>
            )}

            {schoolId && <div className="px-4 pt-4 pb-1"><p className="text-white/40 text-xs uppercase tracking-wider font-semibold">Navigation</p></div>}

            <nav className="flex-1 px-3 pb-4 space-y-0.5">
                {navItems.map(item => <NavLink key={item.href} item={item} />)}
            </nav>

            {/* User profile */}
            <div className="px-4 py-4 border-t border-white/20">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {user?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{user?.name || 'Loading...'}</p>
                        <p className="text-white/50 text-xs capitalize">{user?.role?.replace(/_/g, ' ') || ''}</p>
                    </div>
                </div>
                <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl text-xs font-medium transition-all">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                </button>
            </div>
        </div>
    );
}
