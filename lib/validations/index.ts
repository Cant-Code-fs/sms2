import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});
export type LoginFormData = z.infer<typeof loginSchema>;

const indianPhone = z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')
    .or(z.string().regex(/^\+91[6-9]\d{9}$/, 'Enter a valid Indian mobile number'));

export const studentSchema = z.object({
    first_name: z.string().min(1, 'First name is required').max(50),
    last_name: z.string().min(1, 'Last name is required').max(50),
    admission_no: z.string().min(1, 'Admission number is required'),
    date_of_birth: z.string().min(1, 'Date of birth is required'),
    gender: z.enum(['male', 'female', 'other'], { errorMap: () => ({ message: 'Select gender' }) }),
    section_id: z.string().min(1, 'Section is required'),
    parent_name: z.string().min(1, 'Parent name is required').max(100),
    parent_phone: indianPhone,
    parent_email: z.string().email('Invalid email').optional().or(z.literal('')),
    address: z.string().optional(),
    admission_date: z.string().optional(),
    photo_url: z.string().optional(),
});
export type StudentFormData = z.infer<typeof studentSchema>;

export const feeTypeSchema = z.object({
    name: z.string().min(1, 'Fee type name is required'),
    fee_category: z.enum(['monthly', 'transport', 'examination', 'annual', 'one_time']),
    description: z.string().optional(),
    has_late_fine: z.boolean(),
});
export type FeeTypeFormData = z.infer<typeof feeTypeSchema>;

export const feeStructureSchema = z.object({
    fee_type_id: z.string().min(1, 'Fee type is required'),
    class_id: z.string().min(1, 'Class is required'),
    amount: z.number().positive('Amount must be positive'),
    academic_year: z.string().regex(/^\d{4}-\d{2}$/, 'Format: 2024-25'),
});
export type FeeStructureFormData = z.infer<typeof feeStructureSchema>;

export const transportRouteSchema = z.object({
    route_name: z.string().min(1, 'Route name is required'),
    description: z.string().optional(),
    monthly_fee: z.number().positive('Monthly fee must be positive'),
});
export type TransportRouteFormData = z.infer<typeof transportRouteSchema>;

export const concessionSchema = z.object({
    amount: z.number().min(0, 'Concession cannot be negative'),
    reason: z.string().min(5, 'Please provide a reason for the concession'),
});

export const staffSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    phone: indianPhone.optional().or(z.literal('')),
    role: z.enum(['super_admin', 'school_admin', 'accountant', 'receptionist']),
    school_id: z.string().optional(),
});
export type StaffFormData = z.infer<typeof staffSchema>;

export const schoolSchema = z.object({
    name: z.string().min(1, 'School name is required'),
    address: z.string().min(1, 'Address is required'),
    phone: z.string().min(1, 'Phone is required'),
    email: z.string().email('Invalid email'),
    receipt_prefix: z.string().min(2, 'Receipt prefix is required').max(8),
});
export type SchoolFormData = z.infer<typeof schoolSchema>;

export const cancelReceiptSchema = z.object({
    cancel_reason: z.string().min(5, 'Please provide a cancellation reason (min 5 characters)'),
});
