import type { ChangeOrder, Invoice, Project } from './types.js';
import { AppError } from './domain.js';

export const PAYPAL_BASE = 'https://api-m.sandbox.paypal.com';
interface PayPalInvoice {
  id: string;
  status: string;
  detail?: {
    invoice_number?: string;
    reference?: string;
    currency_code?: string;
    metadata?: { recipient_view_url?: string };
  };
  amount?: { value?: string; currency_code?: string };
  due_amount?: { value?: string; currency_code?: string };
  payments?: {
    paid_amount?: { value?: string };
    transactions?: { amount?: { value?: string }; payment_type?: string }[];
  };
  links?: { rel: string; href: string }[];
}
export interface PayPalGateway {
  createInvoice(project: Project, order: ChangeOrder): Promise<Invoice>;
  sendInvoice(invoiceId: string): Promise<void>;
  getInvoice(invoiceId: string): Promise<Invoice>;
  verifyWebhook(headers: Record<string, string | undefined>, event: unknown): Promise<boolean>;
}
export function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}
function money(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}
export function mapInvoice(invoice: PayPalInvoice): Invoice {
  const amountCents = money(invoice.amount?.value);
  // Explicit received funds take precedence over the status label. An inconsistent
  // PAID snapshot must not conceal a smaller recorded payment or infer cash from credits.
  const paidAmountCents =
    invoice.payments?.paid_amount?.value !== undefined
      ? money(invoice.payments.paid_amount.value)
      : invoice.status === 'PAID'
        ? amountCents
        : 0;
  const candidate =
    invoice.detail?.metadata?.recipient_view_url ||
    invoice.links?.find((link) => ['payer-view', 'recipient-view'].includes(link.rel))?.href;
  let paymentUrl: string | undefined;
  if (candidate) {
    try {
      const url = new URL(candidate);
      if (
        url.protocol === 'https:' &&
        (url.hostname === 'sandbox.paypal.com' || url.hostname.endsWith('.sandbox.paypal.com'))
      )
        paymentUrl = url.href;
    } catch {
      /* Do not expose unexpected gateway URLs. */
    }
  }
  return {
    id: invoice.id,
    number: invoice.detail?.invoice_number,
    reference: invoice.detail?.reference,
    status: invoice.status,
    amountCents,
    currency: invoice.amount?.currency_code || invoice.detail?.currency_code || '',
    paidAmountCents,
    paymentUrl,
    lastSyncedAt: new Date().toISOString(),
  };
}
export class SandboxPayPal implements PayPalGateway {
  private accessToken?: string;
  private tokenExpiresAt = 0;
  private async token() {
    if (!paypalConfigured())
      throw new AppError(
        503,
        'PAYPAL_NOT_CONFIGURED',
        'Connect PayPal sandbox credentials before creating an invoice.',
      );
    if (this.accessToken && Date.now() < this.tokenExpiresAt) return this.accessToken;
    let response: Response;
    try {
      response = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
        method: 'POST',
        signal: AbortSignal.timeout(25000),
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
    } catch {
      throw new AppError(
        502,
        'PAYPAL_UNAVAILABLE',
        'PayPal sandbox could not be reached. Please try again.',
      );
    }
    if (!response.ok)
      throw new AppError(
        502,
        'PAYPAL_AUTH_FAILED',
        `PayPal sandbox authentication returned HTTP ${response.status}. Check your sandbox app credentials.`,
      );
    const body = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token)
      throw new AppError(
        502,
        'PAYPAL_AUTH_FAILED',
        'PayPal sandbox did not return an access token.',
      );
    this.accessToken = body.access_token;
    this.tokenExpiresAt = Date.now() + Math.max(0, (body.expires_in || 300) - 60) * 1000;
    return this.accessToken;
  }
  private async request(
    path: string,
    options: { method?: string; body?: unknown; requestId?: string } = {},
  ) {
    const token = await this.token();
    let response: Response;
    try {
      response = await fetch(`${PAYPAL_BASE}${path}`, {
        method: options.method || 'GET',
        signal: AbortSignal.timeout(30000),
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
          ...(options.requestId ? { 'PayPal-Request-Id': options.requestId } : {}),
        },
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      });
    } catch {
      throw new AppError(
        502,
        'PAYPAL_UNAVAILABLE',
        'PayPal sandbox did not respond. Retry safely using the same proposal.',
      );
    }
    if (!response.ok) {
      let reason = '';
      try {
        const body = (await response.json()) as {
          details?: { issue?: string; description?: string }[];
          name?: string;
        };
        reason =
          body.details
            ?.map((detail) => detail.issue)
            .filter(Boolean)
            .join(', ') ||
          body.name ||
          '';
      } catch {
        /* Error detail is optional. */
      }
      // Never echo gateway request/response bodies or authorization material.
      if (reason.includes('INR_FOREIGN_CURRENCY_BLOCKED'))
        throw new AppError(
          502,
          'SANDBOX_CURRENCY_RESTRICTED',
          'This sandbox merchant cannot issue USD invoices. Configure a USD-capable sandbox business account and buyer, such as a US test-account pair, then create a fresh demo project.',
        );
      throw new AppError(
        502,
        'PAYPAL_REQUEST_FAILED',
        `PayPal sandbox returned HTTP ${response.status}${reason ? ` (${reason.replace(/[^A-Z0-9_, ]/g, '').slice(0, 160)})` : ''}. The payment status has not been assumed. Please retry or refresh.`,
      );
    }
    if (response.status === 204) return null;
    return (await response.json()) as unknown;
  }
  async createInvoice(project: Project, order: ChangeOrder) {
    // A stable invoice number lets retry recovery find an existing invoice even if the create response was lost.
    const number = `CO-${order.id.replace(/-/g, '').slice(0, 18).toUpperCase()}`;
    const body = {
      detail: {
        invoice_number: number,
        reference: order.id,
        currency_code: order.currency,
        invoice_date: new Date().toISOString().slice(0, 10),
        note: `Approved change order: ${order.title}. Original project fee is separate.`,
        term: `Approved by ${order.acceptedBy || project.clientName}. Scope fingerprint: ${order.termsHash}.`,
        payment_term: { term_type: 'DUE_ON_RECEIPT' },
      },
      ...(process.env.PAYPAL_MERCHANT_EMAIL
        ? { invoicer: { email_address: process.env.PAYPAL_MERCHANT_EMAIL } }
        : {}),
      primary_recipients: [{ billing_info: { email_address: order.clientEmail } }],
      items: order.items.map((item) => ({
        name: item.title.slice(0, 200),
        description:
          `${item.description}\n${item.hours} hours at ${(item.rateCents / 100).toFixed(2)} ${order.currency}/hour`.slice(
            0,
            1000,
          ),
        quantity: '1',
        unit_amount: { currency_code: order.currency, value: (item.amountCents / 100).toFixed(2) },
        unit_of_measure: 'QUANTITY',
      })),
      configuration: {
        allow_tip: false,
        partial_payment: { allow_partial_payment: false },
        tax_calculated_after_discount: true,
        tax_inclusive: false,
      },
    };
    let created: PayPalInvoice;
    try {
      created = (await this.request('/v2/invoicing/invoices', {
        method: 'POST',
        body,
        requestId: order.id,
      })) as PayPalInvoice;
    } catch (error) {
      if (!(error instanceof AppError) || !error.message.includes('DUPLICATE_INVOICE_NUMBER'))
        throw error;
      const search = (await this.request('/v2/invoicing/search-invoices', {
        method: 'POST',
        body: { invoice_number: number, page: 1, page_size: 10, total_required: false },
      })) as { items?: PayPalInvoice[] };
      const found = search.items?.find((invoice) => invoice.detail?.invoice_number === number);
      if (!found) throw error;
      created = found;
    }
    if (!created.id || !/^INV2-[A-Z0-9-]+$/i.test(created.id))
      throw new AppError(
        502,
        'PAYPAL_INVALID_RESPONSE',
        'PayPal did not return a valid invoice identifier.',
      );
    const invoice = await this.getInvoice(created.id);
    if (invoice.reference && invoice.reference !== order.id)
      throw new AppError(
        409,
        'INVOICE_IDENTITY_MISMATCH',
        'The PayPal invoice reference does not match this proposal.',
      );
    return invoice;
  }
  async sendInvoice(invoiceId: string) {
    const current = await this.getInvoice(invoiceId);
    if (current.status !== 'DRAFT') return;
    // Share the hosted payment page in ChangeOrder; avoid sending email outside the sandbox demo.
    await this.request(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/send`, {
      method: 'POST',
      body: { send_to_invoicer: false, send_to_recipient: false },
    });
  }
  async getInvoice(invoiceId: string) {
    if (!/^INV2-[A-Z0-9-]+$/i.test(invoiceId))
      throw new AppError(400, 'INVALID_INVOICE', 'Invalid PayPal invoice identifier.');
    const raw = (await this.request(
      `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`,
    )) as PayPalInvoice;
    if (raw.id !== invoiceId)
      throw new AppError(
        502,
        'INVOICE_IDENTITY_MISMATCH',
        'PayPal returned a different invoice than requested. The stored payment record was preserved.',
      );
    if (
      raw.amount?.currency_code &&
      raw.detail?.currency_code &&
      raw.amount.currency_code !== raw.detail.currency_code
    )
      throw new AppError(
        502,
        'INVOICE_CURRENCY_MISMATCH',
        'PayPal returned inconsistent invoice currencies. The stored payment record was preserved.',
      );
    const invoice = mapInvoice(raw);
    if (!invoice.paymentUrl && raw.status !== 'DRAFT')
      invoice.paymentUrl = `https://www.sandbox.paypal.com/invoice/p/#${encodeURIComponent(invoiceId)}`;
    return invoice;
  }
  async verifyWebhook(headers: Record<string, string | undefined>, event: unknown) {
    if (!process.env.PAYPAL_WEBHOOK_ID)
      throw new AppError(
        503,
        'WEBHOOK_NOT_CONFIGURED',
        'Configure the registered PayPal webhook ID before receiving webhooks.',
      );
    const keys = [
      'paypal-auth-algo',
      'paypal-cert-url',
      'paypal-transmission-id',
      'paypal-transmission-sig',
      'paypal-transmission-time',
    ];
    if (keys.some((key) => !headers[key])) return false;
    let certUrl: URL;
    try {
      certUrl = new URL(headers['paypal-cert-url']!);
    } catch {
      return false;
    }
    if (
      certUrl.protocol !== 'https:' ||
      !(certUrl.hostname === 'paypal.com' || certUrl.hostname.endsWith('.paypal.com'))
    )
      return false;
    const result = (await this.request('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      body: {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: process.env.PAYPAL_WEBHOOK_ID,
        webhook_event: event,
      },
    })) as { verification_status?: string };
    return result.verification_status === 'SUCCESS';
  }
}
