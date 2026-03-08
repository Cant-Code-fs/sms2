'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { loginSchema } from '@/lib/validations';
import toast from 'react-hot-toast';

export default function LoginPage() {
    const router = useRouter();
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrors({});

        const validation = loginSchema.safeParse({ email, password });
        if (!validation.success) {
            const fieldErrors: Record<string, string> = {};
            validation.error.errors.forEach((err) => {
                if (err.path[0]) {
                    fieldErrors[err.path[0] as string] = err.message;
                }
            });
            setErrors(fieldErrors);
            return;
        }

        setLoading(true);
        const result = await signIn(email, password);

        if (result.error) {
            toast.error(result.error);
            setLoading(false);
            return;
        }

        toast.success('Welcome back!');

        // Fetch user profile to determine redirect
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                const role = data.user?.role;
                const schoolId = data.user?.schoolId;

                if (role === 'super_admin') {
                    router.push('/dashboard');
                } else if (schoolId) {
                    router.push(`/schools/${schoolId}/dashboard`);
                } else {
                    router.push('/dashboard');
                }
            } else {
                router.push('/dashboard');
            }
        } catch {
            router.push('/dashboard');
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen flex">
            {/* Left panel - branding */}
            <div className="hidden lg:flex lg:w-1/2 gradient-primary items-center justify-center p-12">
                <div className="max-w-md text-center">
                    <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-8">
                        <span className="text-4xl">🏫</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-4">
                        School Management System
                    </h1>
                    <p className="text-white/70 text-lg leading-relaxed">
                        Comprehensive fee management for multiple schools.
                        Track collections, generate receipts, and manage student finances.
                    </p>
                    <div className="mt-12 grid grid-cols-3 gap-4 text-center">
                        <div className="bg-white/10 rounded-xl p-4">
                            <div className="text-2xl font-bold text-white">2</div>
                            <div className="text-white/60 text-xs mt-1">Schools</div>
                        </div>
                        <div className="bg-white/10 rounded-xl p-4">
                            <div className="text-2xl font-bold text-white">10</div>
                            <div className="text-white/60 text-xs mt-1">Classes</div>
                        </div>
                        <div className="bg-white/10 rounded-xl p-4">
                            <div className="text-2xl font-bold text-white">∞</div>
                            <div className="text-white/60 text-xs mt-1">Students</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right panel - login form */}
            <div className="flex-1 flex items-center justify-center p-6 bg-[#F8FAFC]">
                <div className="w-full max-w-md">
                    <div className="lg:hidden text-center mb-8">
                        <div className="w-16 h-16 bg-[#1E3A5F] rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <span className="text-3xl">🏫</span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">School Manager</h1>
                    </div>

                    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
                            <p className="text-gray-500 mt-2 text-sm">
                                Sign in to your account to continue
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <Input
                                label="Email Address"
                                type="email"
                                placeholder="you@school.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                error={errors.email}
                                required
                                icon={
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                }
                            />

                            <Input
                                label="Password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                error={errors.password}
                                required
                                icon={
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                }
                            />

                            <Button
                                type="submit"
                                loading={loading}
                                className="w-full"
                                size="lg"
                            >
                                Sign In
                            </Button>
                        </form>

                        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                            <p className="text-xs text-gray-400">
                                Staff accounts are managed by your administrator.
                                <br />
                                Contact admin for access.
                            </p>
                        </div>
                    </div>

                    <p className="text-center text-xs text-gray-400 mt-6">
                        © {new Date().getFullYear()} School Management System
                    </p>
                </div>
            </div>
        </div>
    );
}
