import prisma from '@/lib/prisma';

const WATI_API_URL = process.env.WATI_API_URL || '';
const WATI_API_KEY = process.env.WATI_API_KEY || '';

interface WatiResponse {
    result: boolean;
    error?: string;
}

async function sendTemplateMessage(
    phoneNumber: string,
    templateName: string,
    parameters: Array<{ name: string; value: string }>,
    studentId: string,
    messageType: string,
): Promise<{ success: boolean; error?: string }> {
    if (!WATI_API_URL || !WATI_API_KEY) {
        console.warn('WATI credentials not configured, skipping WhatsApp');
        return { success: false, error: 'WATI not configured' };
    }

    const cleanPhone = phoneNumber.replace('+', '');

    try {
        const response = await fetch(
            `${WATI_API_URL}/api/v1/sendTemplateMessage?whatsappNumber=${cleanPhone}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${WATI_API_KEY}`,
                },
                body: JSON.stringify({
                    template_name: templateName,
                    broadcast_name: templateName,
                    parameters,
                }),
            }
        );

        const data = await response.json() as WatiResponse;

        await prisma.whatsappLog.create({
            data: {
                student_id: studentId,
                phone: phoneNumber,
                message_type: messageType,
                template_name: templateName,
                parameters: parameters as unknown as object,
                status: data.result ? 'sent' : 'failed',
                error_message: data.error || null,
            },
        });

        return { success: data.result, error: data.error };
    } catch (error) {
        await prisma.whatsappLog.create({
            data: {
                student_id: studentId,
                phone: phoneNumber,
                message_type: messageType,
                template_name: templateName,
                parameters: parameters as unknown as object,
                status: 'failed',
                error_message: error instanceof Error ? error.message : 'Unknown error',
            },
        });
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function sendPaymentConfirmation(
    studentId: string,
    parentName: string,
    amount: string,
    studentName: string,
    paymentDate: string,
    receiptNumber: string,
    schoolName: string,
    parentPhone: string,
) {
    return sendTemplateMessage(parentPhone, 'fee_payment_confirmation', [
        { name: 'parent_name', value: parentName },
        { name: 'amount', value: amount },
        { name: 'student_name', value: studentName },
        { name: 'date', value: paymentDate },
        { name: 'receipt_number', value: receiptNumber },
        { name: 'school_name', value: schoolName },
    ], studentId, 'payment_confirmation');
}

export async function sendDueReminder(
    studentId: string,
    parentName: string,
    studentName: string,
    className: string,
    schoolName: string,
    amount: string,
    months: string,
    dueDate: string,
    schoolPhone: string,
    parentPhone: string,
) {
    return sendTemplateMessage(parentPhone, 'fee_due_reminder', [
        { name: 'parent_name', value: parentName },
        { name: 'student_name', value: studentName },
        { name: 'class', value: className },
        { name: 'months', value: months },
        { name: 'amount', value: amount },
        { name: 'due_date', value: dueDate },
        { name: 'school_name', value: schoolName },
        { name: 'school_phone', value: schoolPhone },
    ], studentId, 'due_reminder');
}

export async function sendOverdueReminder(
    studentId: string,
    parentName: string,
    studentName: string,
    totalDue: string,
    schoolName: string,
    schoolPhone: string,
    parentPhone: string,
) {
    return sendTemplateMessage(parentPhone, 'fee_overdue_reminder', [
        { name: 'parent_name', value: parentName },
        { name: 'student_name', value: studentName },
        { name: 'total_due', value: totalDue },
        { name: 'school_name', value: schoolName },
        { name: 'school_phone', value: schoolPhone },
    ], studentId, 'overdue_reminder');
}

export async function wasRecentlySent(
    studentId: string,
    messageType: string,
    withinDays: number,
): Promise<boolean> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - withinDays);

    const recent = await prisma.whatsappLog.findFirst({
        where: {
            student_id: studentId,
            message_type: messageType,
            status: 'sent',
            sent_at: { gte: cutoff },
        },
    });

    return !!recent;
}
