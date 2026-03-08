/**
 * formatDate.ts
 * All dates formatted in IST (Indian Standard Time)
 */

const IST_OFFSET = 5.5 * 60 * 60 * 1000; // +5:30

export function getCurrentIST(): Date {
    return new Date(new Date().getTime() + IST_OFFSET - new Date().getTimezoneOffset() * 60 * 1000);
}

export function formatDate(dateStr: string | Date): string {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    });
}

export function formatDateTime(dateStr: string | Date): string {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
    });
}

export function formatMonthYear(date: Date): string {
    return date.toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    });
}

/** Get greeting based on IST time */
export function getGreeting(): string {
    const hour = new Date().toLocaleString('en-IN', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' });
    const h = parseInt(hour);
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
}

/** Used internally for cron job */
export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(value);
}
