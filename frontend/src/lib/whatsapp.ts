import { formatINRShort, formatINR } from './formatters';

export interface WorkshopProfile {
  name: string;
  address: string;
  phone: string;
  email?: string;
  gstin?: string;
  upi_id?: string;
  terms?: string;
  footer?: string;
}

/**
 * Normalizes Indian phone numbers into standard international format for WhatsApp wa.me links.
 * E.g.: "9876543210" -> "919876543210"
 * "+91 98765-43210" -> "919876543210"
 * "09876543210" -> "919876543210"
 */
export function normalizeWhatsAppPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

/**
 * Generates an instant UPI payment deep link that automatically opens
 * Google Pay, PhonePe, Paytm, or BHIM on the customer's phone with amount & payee prefilled.
 */
export function generateUpiPayLink(params: {
  upiId?: string;
  payeeName?: string;
  amountPaise: number;
  invoiceNo?: string;
}): string {
  if (!params.upiId) return '';
  const amountRupees = (params.amountPaise / 100).toFixed(2);
  const upiId = params.upiId.trim();
  const payee = encodeURIComponent(params.payeeName || 'Automotive Workshop');
  return `https://upiqr.in/pay/${encodeURIComponent(upiId)}?am=${amountRupees}&pn=${payee}`;
}

/**
 * 1. Vehicle Intake & Gatepass Message
 */
export function buildJobCardIntakeMessage(params: {
  customerName: string;
  vehicleReg: string;
  vehicleModel?: string;
  jobCardNo: string;
  date: string;
  odometer?: number;
  fuelLevel?: string;
  complaints?: string[];
  workshop?: WorkshopProfile | null;
}): string {
  const wsName = (params.workshop?.name || 'Automotive Services').toUpperCase();
  const wsPhone = params.workshop?.phone || '';
  const wsAddress = params.workshop?.address || '';

  const complaintsList = params.complaints && params.complaints.length > 0
    ? params.complaints.map(c => `• ${c}`).join('\n')
    : '• General periodic service & diagnostic check';

  const odoStr = params.odometer ? `${params.odometer.toLocaleString('en-IN')} km` : 'Not recorded';
  const fuelStr = params.fuelLevel || 'Not recorded';

  return `🚗 *${wsName}*
*Vehicle Check-in Confirmation*
──────────────────────────────
Dear *${params.customerName}*,
Your vehicle *${params.vehicleReg}*${params.vehicleModel ? ` (${params.vehicleModel})` : ''} has been safely checked into our workshop.

📋 *Job Card No:* ${params.jobCardNo}
📅 *Date:* ${params.date}
⏱️ *Odometer:* ${odoStr}  |  ⛽ *Fuel Level:* ${fuelStr}

🛠️ *Reported Work & Complaints:*
${complaintsList}

Our team is inspecting your vehicle and will share the service estimate shortly.

${wsPhone ? `📞 Workshop Contact: ${wsPhone}\n` : ''}${wsAddress ? `📍 Address: ${wsAddress}\n` : ''}Thank you for your trust!`;
}

/**
 * 2. Service Estimate for Customer Approval
 */
export function buildEstimateApprovalMessage(params: {
  customerName: string;
  vehicleReg: string;
  vehicleModel?: string;
  jobCardNo: string;
  grandTotalPaise: number;
  labourTotalPaise: number;
  partsTotalPaise: number;
  otherChargesPaise?: number;
  workSummary?: string;
  workshop?: WorkshopProfile | null;
}): string {
  const wsName = (params.workshop?.name || 'Automotive Services').toUpperCase();
  const wsPhone = params.workshop?.phone || '';

  const otherText = params.otherChargesPaise && params.otherChargesPaise > 0
    ? `\n• Consumables & Other: ${formatINRShort(params.otherChargesPaise)}`
    : '';

  const summaryText = params.workSummary ? `\n\n🔍 *Summary of Work:*\n${params.workSummary}` : '';

  return `📑 *SERVICE ESTIMATE FOR APPROVAL*
*${wsName}*
──────────────────────────────
Dear *${params.customerName}*,
The inspection estimate for your *${params.vehicleReg}*${params.vehicleModel ? ` (${params.vehicleModel})` : ''} is ready.

💰 *Estimated Grand Total:* *${formatINRShort(params.grandTotalPaise)}*
• Labour & Services: ${formatINRShort(params.labourTotalPaise)}
• Parts & Materials: ${formatINRShort(params.partsTotalPaise)}${otherText}${summaryText}

👉 *Please reply "APPROVED"* to authorize our team to proceed, or contact us with any questions.

${wsPhone ? `📞 Workshop Phone: ${wsPhone}` : ''}`;
}

/**
 * 3. Vehicle Ready for Delivery + 1-Click UPI Payment Link
 */
export function buildReadyForDeliveryMessage(params: {
  customerName: string;
  vehicleReg: string;
  vehicleModel?: string;
  invoiceNo?: string;
  grandTotalPaise: number;
  balanceDuePaise: number;
  workshop?: WorkshopProfile | null;
}): string {
  const wsName = (params.workshop?.name || 'Automotive Services').toUpperCase();
  const wsPhone = params.workshop?.phone || '';
  const wsAddress = params.workshop?.address || '';
  const upiId = params.workshop?.upi_id || '';

  let upiSection = '';
  if (upiId && params.balanceDuePaise > 0) {
    const payLink = generateUpiPayLink({
      upiId,
      payeeName: params.workshop?.name,
      amountPaise: params.balanceDuePaise,
      invoiceNo: params.invoiceNo
    });
    upiSection = `\n📲 *Pay directly via UPI (GPay/PhonePe/Paytm):*\n${payLink}\n(UPI ID: \`${upiId}\`)\n`;
  }

  return `✅ *VEHICLE READY FOR DELIVERY*
*${wsName}*
──────────────────────────────
Dear *${params.customerName}*,
Great news! Your *${params.vehicleReg}*${params.vehicleModel ? ` (${params.vehicleModel})` : ''} has been serviced, quality-checked, and is ready for pickup!

${params.invoiceNo ? `🧾 *Invoice No:* ${params.invoiceNo}\n` : ''}💵 *Total Bill:* ${formatINRShort(params.grandTotalPaise)}
💳 *Balance Due:* *${formatINR(params.balanceDuePaise)}*
${upiSection}
${wsAddress ? `📍 Workshop Address: ${wsAddress}\n` : ''}${wsPhone ? `📞 Contact: ${wsPhone}\n` : ''}See you soon!`;
}

/**
 * 4. Digital Invoice & Payment Receipt Share
 */
export function buildInvoiceReceiptMessage(params: {
  customerName: string;
  vehicleReg: string;
  vehicleModel?: string;
  invoiceNo: string;
  amountPaidPaise: number;
  balanceDuePaise: number;
  paymentMethod?: string;
  paymentDate?: string;
  workshop?: WorkshopProfile | null;
}): string {
  const wsName = (params.workshop?.name || 'Automotive Services').toUpperCase();
  const wsPhone = params.workshop?.phone || '';

  const statusText = params.balanceDuePaise <= 0 ? 'PAID IN FULL ✅' : `PARTIAL PAYMENT (Balance: ${formatINR(params.balanceDuePaise)})`;

  return `🧾 *PAYMENT RECEIPT & INVOICE*
*${wsName}*
──────────────────────────────
Dear *${params.customerName}*,
Thank you for your payment! Here are your receipt details:

📋 *Invoice No:* ${params.invoiceNo}
🚗 *Vehicle:* ${params.vehicleReg}${params.vehicleModel ? ` (${params.vehicleModel})` : ''}
💵 *Amount Paid:* *${formatINR(params.amountPaidPaise)}* (${params.paymentMethod || 'UPI/Cash'})
💳 *Status:* ${statusText}
📅 *Date:* ${params.paymentDate || new Date().toLocaleDateString('en-IN')}

Thank you for choosing ${params.workshop?.name || 'our workshop'}! Have a safe and smooth drive.

${wsPhone ? `📞 Support: ${wsPhone}` : ''}`;
}

/**
 * 5. Outstanding Receivable Reminder
 */
export function buildPaymentReminderMessage(params: {
  customerName: string;
  vehicleReg: string;
  invoiceNo: string;
  balanceDuePaise: number;
  daysOverdue?: number;
  workshop?: WorkshopProfile | null;
}): string {
  const wsName = (params.workshop?.name || 'Automotive Services').toUpperCase();
  const wsPhone = params.workshop?.phone || '';
  const upiId = params.workshop?.upi_id || '';

  let upiSection = '';
  if (upiId && params.balanceDuePaise > 0) {
    const payLink = generateUpiPayLink({
      upiId,
      payeeName: params.workshop?.name,
      amountPaise: params.balanceDuePaise,
      invoiceNo: params.invoiceNo
    });
    upiSection = `\n📲 *Tap here to pay directly via UPI:*\n${payLink}\n(UPI ID: \`${upiId}\`)\n`;
  }

  const overdueNotice = params.daysOverdue && params.daysOverdue > 0 ? ` (${params.daysOverdue} days past service)` : '';

  return `🔔 *PAYMENT REMINDER*
*${wsName}*
──────────────────────────────
Dear *${params.customerName}*,
Greetings from ${params.workshop?.name || 'our workshop'}.

This is a gentle reminder regarding the pending balance of *${formatINR(params.balanceDuePaise)}* for invoice *${params.invoiceNo}* on vehicle *${params.vehicleReg}*${overdueNotice}.
${upiSection}
Please let us know once paid so we can update your receipt records. Thank you!

${wsPhone ? `📞 Accounts Contact: ${wsPhone}` : ''}`;
}

/**
 * Native wa.me browser opener: opens WhatsApp Web on Desktop or WhatsApp App on Mobile.
 */
export function openWhatsApp(phone: string | undefined | null, text: string): void {
  const cleanPhone = normalizeWhatsAppPhone(phone);
  if (!cleanPhone) {
    alert('No valid phone number provided for WhatsApp communication.');
    return;
  }
  const encodedText = encodeURIComponent(text);
  const url = `https://wa.me/${cleanPhone}?text=${encodedText}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
