'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { Header } from '@/components/layout/header';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { studentSchema, type StudentFormData } from '@/lib/validations';
import toast from 'react-hot-toast';

export default function AddStudentPage() {
    const params = useParams();
    const router = useRouter();
    const queryClient = useQueryClient();
    const schoolId = params.schoolId as string;

    const [selectedClassId, setSelectedClassId] = useState('');
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);

    const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<StudentFormData>({
        resolver: zodResolver(studentSchema),
        defaultValues: {
            admission_date: new Date().toISOString().split('T')[0],
            gender: 'male',
        },
    });

    // Load classes
    const { data: classesData } = useQuery({
        queryKey: ['classes', schoolId],
        queryFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/classes`);
            return res.json();
        },
    });

    // Load sections based on selected class
    const { data: sectionsData } = useQuery({
        queryKey: ['sections', schoolId, selectedClassId],
        queryFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/classes/${selectedClassId}/sections`);
            return res.json();
        },
        enabled: !!selectedClassId,
    });

    // Auto-generate admission number
    const { data: admNoData } = useQuery({
        queryKey: ['next-adm-no', schoolId],
        queryFn: async () => {
            const res = await fetch(`/api/schools/${schoolId}/students/next-adm-no`);
            return res.json();
        },
    });

    useEffect(() => {
        if (admNoData?.data?.admissionNo) {
            setValue('admission_no', admNoData.data.admissionNo);
        }
    }, [admNoData, setValue]);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Photo must be under 2MB');
            return;
        }
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
    };

    const createMutation = useMutation({
        mutationFn: async (formData: StudentFormData) => {
            let photoUrl = null;

            // Upload photo if selected
            if (photoFile) {
                const uploadForm = new FormData();
                uploadForm.append('file', photoFile);
                uploadForm.append('schoolId', schoolId);
                const uploadRes = await fetch('/api/upload/photo', { method: 'POST', body: uploadForm });
                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    photoUrl = uploadData.url;
                }
            }

            const res = await fetch(`/api/schools/${schoolId}/students`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, photo_url: photoUrl }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create student');
            }
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
            toast.success('Student added successfully!');
            router.push(`/schools/${schoolId}/students/${data.data.id}`);
        },
        onError: (err: Error) => {
            toast.error(err.message);
        },
    });

    const classOptions = [
        { value: '', label: 'Select Class' },
        ...((classesData?.data || []).map((c: { id: string; name: string }) => ({ value: c.id, label: c.name }))),
    ];

    const sectionOptions = [
        { value: '', label: 'Select Section' },
        ...((sectionsData?.data || []).map((s: { id: string; name: string }) => ({ value: s.id, label: s.name }))),
    ];

    return (
        <AppLayout>
            <Header title="Add New Student" subtitle="Create a new student record" />
            <div className="p-6 max-w-3xl mx-auto">
                <form onSubmit={handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">
                    {/* Photo Upload */}
                    <Card>
                        <h3 className="text-base font-semibold text-gray-900 mb-4">Student Photo</h3>
                        <div className="flex items-center gap-6">
                            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-100 flex items-center justify-center">
                                {photoPreview ? (
                                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-3xl">👤</span>
                                )}
                            </div>
                            <div>
                                <label className="cursor-pointer">
                                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E3A5F] text-white text-sm font-medium rounded-xl hover:bg-[#162d4a] transition-colors">
                                        📷 Upload Photo
                                    </span>
                                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                                </label>
                                <p className="text-xs text-gray-400 mt-2">Max 2MB. JPG, PNG, WEBP.</p>
                            </div>
                        </div>
                    </Card>

                    {/* Personal Information */}
                    <Card>
                        <h3 className="text-base font-semibold text-gray-900 mb-4">Personal Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="First Name" {...register('first_name')} error={errors.first_name?.message} required />
                            <Input label="Last Name" {...register('last_name')} error={errors.last_name?.message} required />
                            <Input label="Date of Birth" type="date" {...register('date_of_birth')} error={errors.date_of_birth?.message} required />
                            <Select
                                label="Gender"
                                options={[
                                    { value: 'male', label: 'Male' },
                                    { value: 'female', label: 'Female' },
                                    { value: 'other', label: 'Other' },
                                ]}
                                {...register('gender')}
                                error={errors.gender?.message}
                                required
                            />
                        </div>
                    </Card>

                    {/* Academic Information */}
                    <Card>
                        <h3 className="text-base font-semibold text-gray-900 mb-4">Academic Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Admission Number" {...register('admission_no')} error={errors.admission_no?.message} required helperText="Auto-generated — you can override" />
                            <Input label="Admission Date" type="date" {...register('admission_date')} error={errors.admission_date?.message} />
                            <Select
                                label="Class"
                                options={classOptions}
                                value={selectedClassId}
                                onChange={(e) => {
                                    setSelectedClassId(e.target.value);
                                    setValue('section_id', '');
                                }}
                                required
                            />
                            <Select
                                label="Section"
                                options={sectionOptions}
                                {...register('section_id')}
                                error={errors.section_id?.message}
                                disabled={!selectedClassId}
                                required
                            />
                        </div>
                    </Card>

                    {/* Parent Information */}
                    <Card>
                        <h3 className="text-base font-semibold text-gray-900 mb-4">Parent / Guardian Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input label="Parent / Guardian Name" {...register('parent_name')} error={errors.parent_name?.message} required />
                            <Input label="Parent Phone" type="tel" placeholder="9876543210" {...register('parent_phone')} error={errors.parent_phone?.message} required helperText="10-digit Indian mobile number" />
                            <Input label="Parent Email" type="email" {...register('parent_email')} error={errors.parent_email?.message} className="md:col-span-2" />
                        </div>
                    </Card>

                    {/* Address */}
                    <Card>
                        <h3 className="text-base font-semibold text-gray-900 mb-4">Address</h3>
                        <textarea
                            {...register('address')}
                            rows={3}
                            placeholder="Enter student address..."
                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] focus:border-transparent resize-none"
                        />
                    </Card>

                    {/* Submit */}
                    <div className="flex items-center justify-end gap-3">
                        <Button type="button" variant="secondary" onClick={() => router.back()}>Cancel</Button>
                        <Button type="submit" loading={createMutation.isPending}>Add Student</Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
