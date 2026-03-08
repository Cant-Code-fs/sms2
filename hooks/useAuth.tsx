'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { SessionUser } from '@/types';

export interface AuthContextValue {
    user: SessionUser | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    hasPermission: (roles: SessionUser['role'][]) => boolean;
}

export const AuthCtx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [loading, setLoading] = useState(true);
    const supabase = createSupabaseBrowserClient();

    const fetchProfile = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                setUser(data.user ?? null);
            } else {
                setUser(null);
            }
        } catch {
            setUser(null);
        }
    }, []);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (session) {
                    await fetchProfile();
                } else {
                    setUser(null);
                }
                setLoading(false);
            }
        );
        return () => subscription.unsubscribe();
    }, [supabase, fetchProfile]);

    const signIn = useCallback(
        async (email: string, password: string): Promise<{ error: string | null }> => {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                return { error: error.message.includes('Invalid login') ? 'Invalid email or password' : error.message };
            }
            await fetchProfile();
            return { error: null };
        },
        [supabase, fetchProfile]
    );

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
        setUser(null);
        window.location.href = '/login';
    }, [supabase]);

    const hasPermission = useCallback(
        (roles: SessionUser['role'][]) => (user ? roles.includes(user.role) : false),
        [user]
    );

    return (
        <AuthCtx.Provider value={{ user, loading, signIn, signOut, hasPermission }}>
            {children}
        </AuthCtx.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthCtx);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
