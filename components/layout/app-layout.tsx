'use client';

import React from 'react';
import { Sidebar } from './sidebar';

export function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[#F8FAFC]">
            <Sidebar />
            <main className="ml-64 min-h-screen">
                {children}
            </main>
        </div>
    );
}
