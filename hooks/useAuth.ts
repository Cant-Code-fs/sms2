'use client';

// All auth logic lives in useAuth.tsx.
// This file acts as a shim — TypeScript resolves @/hooks/useAuth to THIS file first,
// so we need the full implementation here too (no JSX).
//
// The AuthProvider (which uses JSX) is in components/providers.tsx.
// This file only provides the context and hook.

import { createContext, useContext } from 'react';
import type { SessionUser } from '@/types';

export interface AuthContextValue {
    user: SessionUser | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    hasPermission: (roles: SessionUser['role'][]) => boolean;
}

export const AuthCtx = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthCtx);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
