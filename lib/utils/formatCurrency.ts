/**
 * formatCurrency.ts
 * Formats numbers as Indian Rupee (₹) with proper comma formatting
 */

const INR = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
    if (!amount && amount !== 0) return '₹0';
    return INR.format(amount);
}

export function parseCurrency(value: string): number {
    return parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
}
