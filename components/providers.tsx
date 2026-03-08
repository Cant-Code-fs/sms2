'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthCtx } from '@/hooks/useAuth';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { SessionUser } from '@/types';
import type { AuthContextValue } from '@/hooks/useAuth';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

function AuthProvider({ children }: { children: React.ReactNode }) {
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

    const value: AuthContextValue = { user, loading, signIn, signOut, hasPermission };

    return (
        <AuthCtx.Provider value={value}>
            {children}
        </AuthCtx.Provider>
    );
}

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                {children}
                <Toaster
                    position="top-right"
                    toastOptions={{
                        duration: 4000,
                        style: {
                            background: '#1F2937',
                            color: '#F9FAFB',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: '500',
                        },
                        success: { iconTheme: { primary: '#22C55E', secondary: '#fff' } },
                        error: { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
                    }}
                />
            </AuthProvider>
        </QueryClientProvider>
    );
}
