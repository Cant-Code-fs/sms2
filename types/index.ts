/**
 * Global TypeScript types for the School Management System
 */

// ─── Session ─────────────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'school_admin' | 'accountant' | 'receptionist';
export type PaymentMode = 'cash' | 'upi' | 'cheque' | 'bank_transfer';

export interface SessionUser {
    id: string;
    staffId: string;
    name: string;
    email: string;
    role: UserRole;
    schoolId: string | null;
    supabaseUid: string;
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    total?: number;
    page?: number;
    pageSize?: number;
    totalPages?: number;
}

// ─── Student ──────────────────────────────────────────────────────────────────

export interface StudentListItem {
    id: string;
    school_id: string;
    section_id: string;
    admission_no: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
    gender: string;
    parent_name: string;
    parent_phone: string;
    parent_email: string | null;
    address: string | null;
    photo_url: string | null;
    is_active: boolean;
    admission_date: string;
    section: {
        id: string;
        name: string;
        class: {
            id: string;
            name: string;
            order: number;
        };
    };
    transport_enrollment: {
        id: string;
        is_active: boolean;
        route: {
            id: string;
            route_name: string;
            monthly_fee: number;
        };
    } | null;
}

// ─── Fee Dues ─────────────────────────────────────────────────────────────────

export interface MonthlyFeeDue {
    feeTypeId: string;
    feeTypeName: string;
    month: string;
    amount: number;
    lateFine: number;
    selected: boolean;
}

export interface TransportFeeDue {
    routeId: string;
    routeName: string;
    month: string;
    amount: number;
    lateFine: number;
    selected: boolean;
}

export interface ExamFeeDue {
    feeTypeId: string;
    feeTypeName: string;
    examTermId: string;
    termName: string;
    amount: number;
    lateFine: number;
    oneTimeFeeRecordId: string;
    selected: boolean;
}

export interface AnnualFeeDue {
    feeTypeId: string;
    feeTypeName: string;
    termId: string;
    termName: string;
    amount: number;
    oneTimeFeeRecordId: string;
    selected: boolean;
}

export interface OneTimeFeeDue {
    feeTypeId: string;
    feeTypeName: string;
    termId: string;
    termName: string;
    amount: number;
    oneTimeFeeRecordId: string;
    selected: boolean;
}

export interface StudentDues {
    studentId: string;
    monthly: MonthlyFeeDue[];
    transport: TransportFeeDue[];
    examination: ExamFeeDue[];
    annual: AnnualFeeDue[];
    oneTime: OneTimeFeeDue[];
}

// ─── Fee Breakdown (stored as JSON in Receipt/Payment) ────────────────────────

export interface FeeBreakdown {
    monthly: Array<{
        feeTypeId: string;
        feeTypeName: string;
        month: string;
        amount: number;
        lateFine: number;
    }>;
    transport: Array<{
        routeName: string;
        month: string;
        amount: number;
        lateFine: number;
    }>;
    examination: Array<{
        feeTypeId: string;
        feeTypeName: string;
        examTermId: string;
        termName: string;
        amount: number;
    }>;
    annual: Array<{
        feeTypeId: string;
        feeTypeName: string;
        termId: string;
        termName: string;
        amount: number;
    }>;
    oneTime: Array<{
        feeTypeId: string;
        feeTypeName: string;
        termId: string;
        termName: string;
        amount: number;
    }>;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface SchoolDashboardStats {
    totalActiveStudents: number;
    todayCollection: number;
    thisMonthCollection: number;
    outstandingThisMonth: number;
    overdueAmount: number;
    lateFinesCollected: number;
}

export interface MonthlyTrendPoint {
    month: string;
    amount: number;
}

export interface CategoryBreakdownItem {
    name: string;
    value: number;
}
