import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { Store } from '../server/store.js';
import { sampleAnalysis } from '../server/seed.js';
import type { PayPalGateway } from '../server/paypal.js';
import type { ChangeOrder, Invoice, Project } from '../server/types.js';

class FakePayPal implements PayPalGateway {
  createCalls = 0;
  sendCalls = 0;
  getCalls = 0;
  validWebhook = false;
  lastWebhook: unknown;
  invoice: Invoice = {
    id: 'INV2-TEST-1234',
    status: 'DRAFT',
    amountCents: 12000,
    currency: 'USD',
    paidAmountCents: 0,
    lastSyncedAt: new Date().toISOString(),
  };
  async createInvoice(_project: Project, order: ChangeOrder) {
    this.createCalls++;
    this.invoice.amountCents = order.amountCents;
    return { ...this.invoice };
  }
  async sendInvoice(_id: string) {
    this.sendCalls++;
    this.invoice.status = 'SENT';
    this.invoice.paymentUrl = 'https://www.sandbox.paypal.com/invoice/p/#INV2-TEST-1234';
  }
  async getInvoice(_id: string) {
    this.getCalls++;
    return { ...this.invoice };
  }
  async verifyWebhook(_headers: Record<string, string | undefined>, event: unknown) {
    this.lastWebhook = event;
    return this.validWebhook;
  }
}

test('API binds approval, invoice and payment to immutable terms and rejects forged signals', async () => {
  const store = new Store(':memory:'),
    paypal = new FakePayPal();
  const { app } = createApp({
    store,
    paypal,
    analyze: async (project) => sampleAnalysis(project),
    ownerAccessCode: 'test-access',
    sessionSecret: 'test-secret-value-at-least-thirty-two-chars',
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as { port: number },
    base = `http://127.0.0.1:${address.port}`;
  let cookie = '';
  async function request(
    path: string,
    method = 'GET',
    body?: unknown,
    overrides?: Record<string, string>,
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...overrides,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { response, body: (await response.json()) as any };
  }
  try {
    assert.equal((await request('/api/projects')).response.status, 401);
    assert.equal(
      (await request('/api/session', 'POST', { accessCode: 'incorrect' })).response.status,
      401,
    );
    const login = await request('/api/session', 'POST', { accessCode: 'test-access' });
    cookie = login.response.headers.get('set-cookie')!.split(';')[0]!;
    assert.match(login.response.headers.get('set-cookie')!, /HttpOnly/);
    assert.equal(
      (await request('/api/projects/seed', 'POST', {}, { Origin: 'https://evil.example' })).response
        .status,
      403,
    );
    const seeded = await request('/api/projects/seed', 'POST', {}),
      project = seeded.body.project;
    const analyzed = await request(`/api/projects/${project.id}/analyze`, 'POST', {
        mode: 'sample',
      }),
      analysis = analyzed.body.analysis;
    const included = analysis.items.find((item: any) => item.classification === 'included');
    assert.equal(
      (
        await request(`/api/projects/${project.id}/change-orders`, 'POST', {
          analysisId: analysis.id,
          itemIds: [included.id],
        })
      ).response.status,
      400,
    );
    const created = await request(`/api/projects/${project.id}/change-orders`, 'POST', {
        analysisId: analysis.id,
      }),
      order = created.body.changeOrder;
    assert.equal(order.amountCents, 12000);
    assert.equal(
      (await request(`/api/change-orders/${order.id}/invoice`, 'POST', {})).response.status,
      409,
    );
    assert.equal(paypal.createCalls, 0);
    const shared = await request(`/api/change-orders/${order.id}/share`, 'POST', {}),
      sharedOrder = shared.body.changeOrder;
    assert.match(sharedOrder.reviewToken, /^[a-f0-9]{64}$/);
    assert.equal(
      (await request(`/api/change-orders/${order.id}`, 'PATCH', { title: 'Changed after sharing' }))
        .response.status,
      409,
    );
    const review = await request(`/api/review/${sharedOrder.reviewToken}`);
    assert.equal(review.body.changeOrder.clientEmail, undefined);
    assert.equal(review.body.changeOrder.sourceSnapshot, undefined);
    await request(`/api/projects/${project.id}`, 'PATCH', { baseAmountCents: 99900 });
    const originalFeeReview = await request(`/api/review/${sharedOrder.reviewToken}`);
    assert.equal(originalFeeReview.body.project.baseAmountCents, 30000);
    assert.equal(originalFeeReview.body.changeOrder.originalAmountCents, 30000);
    assert.equal(
      (
        await request(`/api/review/${sharedOrder.reviewToken}/decision`, 'POST', {
          decision: 'accept',
          name: 'Jamie',
          termsHash: 'wrong-hash',
        })
      ).response.status,
      409,
    );
    assert.equal(
      (
        await request(`/api/review/${sharedOrder.reviewToken}/decision`, 'POST', {
          decision: 'accept',
          name: 'Jamie',
          termsHash: sharedOrder.termsHash,
        })
      ).body.changeOrder.status,
      'accepted',
    );
    const firstInvoice = await request(`/api/change-orders/${order.id}/invoice`, 'POST', {});
    assert.equal(firstInvoice.body.changeOrder.status, 'invoiced');
    await Promise.all([
      request(`/api/change-orders/${order.id}/invoice`, 'POST', {}),
      request(`/api/change-orders/${order.id}/invoice`, 'POST', {}),
    ]);
    assert.equal(paypal.createCalls, 1);
    assert.equal(paypal.sendCalls, 1);
    const event = {
      id: 'WH-TEST-1',
      event_type: 'INVOICING.INVOICE.PAID',
      resource: { id: paypal.invoice.id, status: 'PAID' },
      create_time: '2026-11-10T16:00:00Z',
      resource_type: 'invoices',
      event_version: '1.0',
      summary: 'Invoice paid.',
      links: [
        {
          href: 'https://api-m.sandbox.paypal.com/v1/notifications/webhooks-events/WH-TEST-1',
          rel: 'self',
          method: 'GET',
        },
      ],
    };
    assert.equal((await request('/api/webhooks/paypal', 'POST', event)).response.status, 401);
    assert.deepEqual(
      paypal.lastWebhook,
      event,
      'signature verification receives the complete original event, including signed top-level metadata',
    );
    paypal.validWebhook = true;
    // Even a verified PAID event cannot override the authoritative invoice details.
    const webhook = await request('/api/webhooks/paypal', 'POST', event);
    assert.equal(webhook.response.status, 200);
    assert.equal(store.order(order.id)!.status, 'invoiced');
    const beforeRepeat = paypal.getCalls;
    assert.equal((await request('/api/webhooks/paypal', 'POST', event)).body.duplicate, true);
    assert.equal(paypal.getCalls, beforeRepeat);
    paypal.invoice.status = 'PARTIALLY_PAID';
    paypal.invoice.paidAmountCents = 4000;
    assert.equal(
      (await request(`/api/change-orders/${order.id}/sync`, 'POST', {})).body.changeOrder.status,
      'partially_paid',
    );
    paypal.invoice.status = 'PAID';
    paypal.invoice.paidAmountCents = 12000;
    assert.equal(
      (await request(`/api/change-orders/${order.id}/sync`, 'POST', {})).body.changeOrder.status,
      'paid',
    );
    await request(`/api/change-orders/${order.id}/sync`, 'POST', {});
    assert.equal(
      store.events(project.id).filter((event) => event.type === 'payment_verified').length,
      1,
    );
    paypal.invoice.status = 'SENT';
    paypal.invoice.paidAmountCents = 0;
    assert.equal(
      (await request(`/api/change-orders/${order.id}/sync`, 'POST', {})).body.code,
      'INVOICE_STATE_REGRESSED',
    );
    assert.equal(store.order(order.id)!.status, 'paid');
    paypal.invoice.status = 'PAID';
    paypal.invoice.paidAmountCents = 4000;
    assert.equal(
      (await request(`/api/change-orders/${order.id}/sync`, 'POST', {})).body.code,
      'INVOICE_PAYMENT_INCONSISTENT',
    );
    paypal.invoice.paidAmountCents = 12000;
    paypal.invoice.id = 'INV2-WRONG-INVOICE';
    assert.equal(
      (await request(`/api/change-orders/${order.id}/sync`, 'POST', {})).body.code,
      'INVOICE_IDENTITY_MISMATCH',
    );
    paypal.invoice.id = 'INV2-TEST-1234';
    paypal.invoice.currency = 'EUR';
    assert.equal(
      (await request(`/api/change-orders/${order.id}/sync`, 'POST', {})).response.status,
      409,
    );
    assert.equal(store.order(order.id)!.invoice!.currency, 'USD');
    paypal.invoice.currency = 'USD';
    paypal.invoice.amountCents = 13000;
    assert.equal(
      (await request(`/api/change-orders/${order.id}/sync`, 'POST', {})).response.status,
      409,
    );
    assert.equal(store.order(order.id)!.amountCents, 12000);
    paypal.invoice.amountCents = 12000;
    paypal.invoice.status = 'PARTIALLY_REFUNDED';
    assert.equal(
      (await request(`/api/change-orders/${order.id}/sync`, 'POST', {})).body.changeOrder.status,
      'partially_refunded',
    );
    paypal.invoice.status = 'PAID';
    assert.equal(
      (await request(`/api/change-orders/${order.id}/sync`, 'POST', {})).body.code,
      'INVOICE_STATE_REGRESSED',
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    store.close();
  }
});

test('a client decline prevents invoicing and cannot be silently changed to acceptance', async () => {
  const store = new Store(':memory:'),
    paypal = new FakePayPal();
  const { app } = createApp({ store, paypal, ownerAccessCode: '' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  async function post(path: string, body: unknown) {
    const response = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as any };
  }
  try {
    const project = (await post('/api/projects/seed', {})).body.project;
    const analysis = (await post(`/api/projects/${project.id}/analyze`, { mode: 'sample' })).body
      .analysis;
    const order = (
      await post(`/api/projects/${project.id}/change-orders`, { analysisId: analysis.id })
    ).body.changeOrder;
    const shared = (await post(`/api/change-orders/${order.id}/share`, {})).body.changeOrder;
    assert.equal(
      (
        await post(`/api/review/${shared.reviewToken}/decision`, {
          decision: 'decline',
          name: 'Jamie',
          note: 'Please revise the scope.',
        })
      ).body.changeOrder.status,
      'declined',
    );
    assert.equal(
      (
        await post(`/api/review/${shared.reviewToken}/decision`, {
          decision: 'accept',
          name: 'Jamie',
        })
      ).status,
      409,
    );
    assert.equal((await post(`/api/change-orders/${order.id}/invoice`, {})).status, 409);
    assert.equal(paypal.createCalls, 0);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    store.close();
  }
});

test('changed source terms block sharing an old draft while preserving already-shared proposals', async () => {
  const store = new Store(':memory:');
  const { app } = createApp({ store, ownerAccessCode: '' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  async function request(path: string, method = 'POST', body: unknown = {}) {
    const response = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(method !== 'GET' ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: (await response.json()) as any };
  }
  try {
    const project = (await request('/api/projects/seed')).body.project;
    const analysis = (
      await request(`/api/projects/${project.id}/analyze`, 'POST', { mode: 'sample' })
    ).body.analysis;
    const existing = (
      await request(`/api/projects/${project.id}/change-orders`, 'POST', {
        analysisId: analysis.id,
      })
    ).body.changeOrder;
    const staleDraft = (
      await request(`/api/projects/${project.id}/change-orders`, 'POST', {
        analysisId: analysis.id,
      })
    ).body.changeOrder;
    const shared = (await request(`/api/change-orders/${existing.id}/share`)).body.changeOrder;
    await request(`/api/projects/${project.id}`, 'PATCH', {
      brief: `${project.brief}\nAmendment: the mobile checkout flow is now included in the original fee.`,
    });

    const blocked = await request(`/api/change-orders/${staleDraft.id}/share`);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, 'STALE_ANALYSIS');
    assert.equal(store.order(staleDraft.id)!.status, 'draft');
    assert.equal(store.order(staleDraft.id)!.reviewToken, undefined);

    const repeated = await request(`/api/change-orders/${existing.id}/share`);
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.changeOrder.reviewToken, shared.reviewToken);
    assert.equal(repeated.body.changeOrder.termsHash, shared.termsHash);
    assert.equal(store.order(existing.id)!.sourceSnapshot.brief, project.brief);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    store.close();
  }
});
