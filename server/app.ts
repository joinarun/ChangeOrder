import express, { type NextFunction, type Request, type Response } from 'express';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { Store } from './store.js';
import { analyzeWithLLM, llmConfigured } from './llm.js';
import { SandboxPayPal, paypalConfigured, type PayPalGateway } from './paypal.js';
import { AppError, buildLines, newOrder, requireDraft, sourceHash, termsHash } from './domain.js';
import { sampleAnalysis, seedProject } from './seed.js';
import type { Analysis, ChangeOrder, Invoice, Project, ReviewDetail } from './types.js';

type AppOptions = {
  store?: Store;
  paypal?: PayPalGateway;
  analyze?: (project: Project) => Promise<Analysis>;
  ownerAccessCode?: string;
  sessionSecret?: string;
};
const messageInput = z.object({
  text: z.string().trim().min(1).max(16000),
  author: z.string().trim().min(1).max(100).default('Client'),
});
const projectInput = z.object({
  title: z.string().trim().min(1).max(160),
  clientName: z.string().trim().min(1).max(120),
  clientEmail: z.email().max(254),
  freelancerName: z.string().trim().min(1).max(120),
  brief: z.string().trim().min(20).max(60000),
  baseAmountCents: z.number().int().min(0).max(100_000_000).default(30000),
  hourlyRateCents: z.number().int().min(1).max(1_000_000).default(6000),
  currency: z.literal('USD').default('USD'),
  messages: z.array(messageInput).max(100).default([]),
});
const linesInput = z
  .array(
    z.object({
      analysisItemId: z.string().min(1),
      hours: z.number().positive().max(1000),
      rateCents: z.number().int().min(1).max(1_000_000),
    }),
  )
  .min(1)
  .max(20);
const orderInput = z.object({
  analysisId: z.string().min(1),
  itemIds: z.array(z.string()).max(20).optional(),
  items: linesInput.optional(),
  title: z.string().trim().min(1).max(180).optional(),
  summary: z.string().trim().min(1).max(3000).optional(),
});
const patchOrderInput = orderInput.omit({ analysisId: true, itemIds: true }).partial();

function equalSecret(first: string, second: string) {
  const a = Buffer.from(first),
    b = Buffer.from(second);
  return a.length === b.length && timingSafeEqual(a, b);
}
function getCookie(request: Request, name: string) {
  return request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
function safeOrder(order: ChangeOrder) {
  // Bearer review links never need the full source brief or the client's email.
  const {
    sourceSnapshot: _sourceSnapshot,
    clientEmail: _clientEmail,
    reviewToken: _reviewToken,
    ...publicOrder
  } = order;
  return publicOrder;
}

export function createApp(options: AppOptions = {}) {
  const app = express(),
    store = options.store || new Store(),
    paypal = options.paypal || new SandboxPayPal();
  const analyze = options.analyze || analyzeWithLLM;
  const accessCode = options.ownerAccessCode ?? process.env.OWNER_ACCESS_CODE ?? '';
  const sessionSecret =
    options.sessionSecret || process.env.SESSION_SECRET || randomBytes(32).toString('hex');
  if (!accessCode && !['127.0.0.1', 'localhost', '::1'].includes(process.env.HOST || '127.0.0.1'))
    throw new Error('OWNER_ACCESS_CODE is required when binding to a public network interface.');
  const allowedOrigin = new URL(process.env.APP_BASE_URL || 'http://localhost:5173').origin;
  const failures = new Map<string, { count: number; until: number }>();
  const locks = new Map<string, Promise<unknown>>();
  async function locked<T>(id: string, action: () => Promise<T>) {
    const previous = locks.get(id) || Promise.resolve();
    const result = previous.catch(() => undefined).then(action);
    locks.set(id, result);
    try {
      return await result;
    } finally {
      if (locks.get(id) === result) locks.delete(id);
    }
  }
  function sign(value: string) {
    return createHmac('sha256', sessionSecret).update(value).digest('hex');
  }
  function authorized(request: Request) {
    if (!accessCode) return true;
    const cookie = getCookie(request, 'co_session');
    if (!cookie) return false;
    const [expires, signature] = cookie.split('.');
    return Boolean(
      expires &&
      signature &&
      Number(expires) > Date.now() &&
      Number(expires) < Date.now() + 13 * 3600000 &&
      equalSecret(signature, sign(expires)),
    );
  }
  function integrationState() {
    return {
      llm: {
        configured: llmConfigured(),
        model: process.env.LLM_MODEL || 'gpt-4.1',
        provider: 'OpenAI-compatible gateway',
      },
      paypal: {
        configured: paypalConfigured(),
        environment: 'sandbox' as const,
        webhookConfigured: Boolean(process.env.PAYPAL_WEBHOOK_ID),
      },
    };
  }
  function owner(request: Request, _response: Response, next: NextFunction) {
    if (!authorized(request))
      return next(
        new AppError(401, 'AUTH_REQUIRED', 'Enter the workspace access code to continue.'),
      );
    next();
  }
  function projectOrThrow(id: string) {
    const project = store.project(id);
    if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Project not found.');
    return project;
  }
  function orderOrThrow(id: string) {
    const order = store.order(id);
    if (!order) throw new AppError(404, 'PROPOSAL_NOT_FOUND', 'Change order not found.');
    return order;
  }
  function reviewOrThrow(token: string) {
    const order = store.orderByToken(token);
    if (!order || order.status === 'draft')
      throw new AppError(
        404,
        'REVIEW_NOT_FOUND',
        'This review link is unavailable. Ask the freelancer for the current link.',
      );
    return order;
  }
  function detail(projectId: string) {
    return {
      project: projectOrThrow(projectId),
      analysis: store.latestAnalysis(projectId),
      changeOrders: store.list<ChangeOrder>('order', projectId),
      audit: store.events(projectId),
    };
  }
  function reviewDetail(order: ChangeOrder) {
    const project = projectOrThrow(order.projectId);
    return {
      project: {
        id: project.id,
        title: order.projectTitle,
        clientName: order.clientName,
        freelancerName: order.freelancerName,
        currency: project.currency,
        baseAmountCents: order.originalAmountCents ?? project.baseAmountCents,
      },
      changeOrder: safeOrder(order),
      evidence: order.items.flatMap((item) => item.evidence),
      audit: store.events(project.id).filter((event) => event.changeOrderId === order.id),
    } as unknown as ReviewDetail;
  }
  function saveInvoice(order: ChangeOrder, invoice: Invoice, actor: string, webhookId?: string) {
    if (invoice.amountCents !== order.amountCents || invoice.currency !== order.currency)
      throw new AppError(
        409,
        'INVOICE_AMOUNT_MISMATCH',
        'PayPal invoice amount or currency differs from the accepted proposal. Payment has not been marked complete.',
      );
    if (
      (order.invoice && order.invoice.id !== invoice.id) ||
      (invoice.reference && invoice.reference !== order.id)
    )
      throw new AppError(
        409,
        'INVOICE_IDENTITY_MISMATCH',
        'The PayPal invoice does not match this accepted proposal. The stored payment record was preserved.',
      );
    if (invoice.status === 'PAID' && invoice.paidAmountCents < order.amountCents)
      throw new AppError(
        409,
        'INVOICE_PAYMENT_INCONSISTENT',
        'PayPal reported a paid invoice with an incomplete received amount. Payment has not been marked complete. Refresh shortly.',
      );
    const refundStatuses = ['REFUNDED', 'PARTIALLY_REFUNDED', 'MARKED_AS_REFUNDED'];
    const prior = order.invoice;
    if (
      prior &&
      !refundStatuses.includes(invoice.status) &&
      ((prior.status === 'PAID' && invoice.status !== 'PAID') ||
        invoice.paidAmountCents < prior.paidAmountCents ||
        refundStatuses.includes(prior.status))
    )
      throw new AppError(
        409,
        'INVOICE_STATE_REGRESSED',
        'PayPal returned an older payment state. The previously verified payment record was preserved. Refresh again shortly.',
      );
    if (prior?.status === 'REFUNDED' && invoice.status !== 'REFUNDED')
      throw new AppError(
        409,
        'INVOICE_STATE_REGRESSED',
        'PayPal returned an older refund state. The verified refund record was preserved.',
      );
    return store.transaction(() => {
      const latest = orderOrThrow(order.id);
      if (webhookId && store.hasWebhook(webhookId)) return latest;
      const previousStatus = latest.status;
      latest.invoice = invoice;
      if (invoice.status === 'PARTIALLY_REFUNDED') latest.status = 'partially_refunded';
      else if (['REFUNDED', 'MARKED_AS_REFUNDED'].includes(invoice.status))
        latest.status = 'refunded';
      else if (invoice.status === 'PAID' && invoice.paidAmountCents >= latest.amountCents)
        latest.status = 'paid';
      else if (
        invoice.status === 'PARTIALLY_PAID' ||
        (invoice.paidAmountCents > 0 && invoice.paidAmountCents < latest.amountCents)
      )
        latest.status = 'partially_paid';
      else if (invoice.status === 'CANCELLED') latest.status = 'cancelled';
      else if (invoice.status !== 'DRAFT') latest.status = 'invoiced';
      latest.updatedAt = new Date().toISOString();
      store.put('order', latest);
      if (previousStatus !== latest.status)
        store.audit(latest.projectId, {
          changeOrderId: latest.id,
          type: latest.status === 'paid' ? 'payment_verified' : 'invoice_status_changed',
          title: latest.status === 'paid' ? 'PayPal payment verified' : 'PayPal invoice updated',
          detail: `PayPal invoice ${invoice.id} reports ${invoice.status}. ${invoice.paidAmountCents / 100} ${latest.currency} received.`,
          actor,
        });
      if (webhookId) store.recordWebhook(webhookId);
      return latest;
    });
  }
  async function sync(order: ChangeOrder, actor: string, webhookId?: string) {
    if (!order.invoice)
      throw new AppError(409, 'NO_INVOICE', 'Create the approved proposal’s PayPal invoice first.');
    const invoice = await paypal.getInvoice(order.invoice.id);
    return saveInvoice(order, invoice, actor, webhookId);
  }
  app.disable('x-powered-by');
  app.use((_request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  app.use('/api', (_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '160kb' }));
  app.use('/api', (request, _response, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method) || request.path === '/webhooks/paypal')
      return next();
    if (!request.is('application/json'))
      return next(new AppError(415, 'JSON_REQUIRED', 'Send application/json.'));
    const origin = request.get('origin');
    const ownOrigin = `${request.protocol}://${request.get('host')}`;
    if (origin && origin !== allowedOrigin && origin !== ownOrigin)
      return next(
        new AppError(
          403,
          'ORIGIN_REJECTED',
          'This action must originate from the ChangeOrder application.',
        ),
      );
    next();
  });
  app.get('/api/health', (_request, response) =>
    response.json({
      ok: true,
      app: 'ChangeOrder',
      environment: 'sandbox',
      integrations: integrationState(),
    }),
  );
  app.get('/api/session', (request, response) =>
    response.json({
      authorized: authorized(request),
      authRequired: Boolean(accessCode),
      integrations: integrationState(),
    }),
  );
  app.post('/api/session', (request, response) => {
    const { accessCode: input } = z.object({ accessCode: z.string().max(200) }).parse(request.body);
    const key = request.ip || 'local',
      failure = failures.get(key);
    if (failure && failure.until > Date.now() && failure.count >= 8)
      throw new AppError(
        429,
        'TOO_MANY_ATTEMPTS',
        'Too many attempts. Try again in fifteen minutes.',
      );
    if (accessCode && !equalSecret(input, accessCode)) {
      const active =
        failure && failure.until > Date.now()
          ? failure
          : { count: 0, until: Date.now() + 15 * 60000 };
      active.count++;
      failures.set(key, active);
      throw new AppError(401, 'INVALID_ACCESS_CODE', 'The workspace access code is incorrect.');
    }
    failures.delete(key);
    const expires = String(Date.now() + 12 * 3600000);
    response.cookie('co_session', `${expires}.${sign(expires)}`, {
      httpOnly: true,
      sameSite: 'lax',
      secure: allowedOrigin.startsWith('https:'),
      maxAge: 12 * 3600000,
      path: '/',
    });
    response.json({
      authorized: true,
      authRequired: Boolean(accessCode),
      integrations: integrationState(),
    });
  });
  app.delete('/api/session', (_request, response) => {
    response.clearCookie('co_session', { path: '/' });
    response.json({ ok: true });
  });
  app.get('/api/projects', owner, (_request, response) =>
    response.json({ projects: store.list<Project>('project').reverse() }),
  );
  app.post('/api/projects/seed', owner, (_request, response) => {
    const project = seedProject();
    store.put('project', project);
    store.audit(project.id, {
      type: 'project_created',
      title: 'Demo workspace ready',
      detail:
        'Original $300 agreement and three synthetic client requests loaded. Sandbox buyer address uses local configuration.',
      actor: 'Freelancer',
    });
    response.status(201).json({ project });
  });
  app.post('/api/projects', owner, (request, response) => {
    const input = projectInput.parse(request.body),
      now = new Date().toISOString();
    const project: Project = {
      ...input,
      id: randomUUID(),
      messages: input.messages.map((message) => ({ ...message, id: randomUUID(), createdAt: now })),
      createdAt: now,
      updatedAt: now,
    };
    store.put('project', project);
    store.audit(project.id, {
      type: 'project_created',
      title: 'Original agreement saved',
      detail: 'The agreement and client requests form the source record for this project.',
      actor: 'Freelancer',
    });
    response.status(201).json({ project });
  });
  app.get('/api/projects/:id', owner, (request, response) =>
    response.json(detail(request.params.id as string)),
  );
  app.patch('/api/projects/:id', owner, (request, response) => {
    const project = projectOrThrow(request.params.id as string);
    const input = projectInput.omit({ messages: true }).partial().parse(request.body);
    Object.assign(project, input, { updatedAt: new Date().toISOString() });
    store.put('project', project);
    store.audit(project.id, {
      type: 'sources_updated',
      title: 'Project sources updated',
      detail:
        'Run scope analysis again before creating a new proposal. Existing shared proposals retain their original evidence.',
      actor: 'Freelancer',
    });
    response.json({ project });
  });
  app.post('/api/projects/:id/messages', owner, (request, response) => {
    const project = projectOrThrow(request.params.id as string),
      input = messageInput.parse(request.body);
    if (project.messages.length >= 100)
      throw new AppError(400, 'MESSAGE_LIMIT', 'A project supports up to one hundred messages.');
    const message = { ...input, id: randomUUID(), createdAt: new Date().toISOString() };
    project.messages.push(message);
    project.updatedAt = message.createdAt;
    store.put('project', project);
    store.audit(project.id, {
      type: 'message_added',
      title: 'Client request added',
      detail: input.text.slice(0, 240),
      actor: input.author,
    });
    response.status(201).json({ project, message });
  });
  app.post('/api/projects/:id/analyze', owner, async (request, response) => {
    const { mode } = z
      .object({ mode: z.enum(['live', 'sample']).default('live') })
      .parse(request.body);
    const project = projectOrThrow(request.params.id as string);
    if (!project.messages.length)
      throw new AppError(400, 'NO_REQUESTS', 'Add a client request before analyzing scope.');
    const analysis = mode === 'sample' ? sampleAnalysis(project) : await analyze(project);
    if (sourceHash(projectOrThrow(project.id)) !== analysis.sourceHash)
      throw new AppError(
        409,
        'SOURCES_CHANGED',
        'The project changed during analysis. Analyze the latest sources again.',
      );
    store.put('analysis', analysis);
    store.audit(project.id, {
      type: 'scope_analyzed',
      title: mode === 'live' ? 'AI scope analysis complete' : 'Sample scope analysis loaded',
      detail: `${analysis.items.filter((item) => item.classification === 'change').length} additional-work findings. Evidence quotations verified against original sources. ${analysis.model}.`,
      actor: mode === 'live' ? 'AI analyst' : 'Sample walkthrough',
    });
    response.json({ analysis });
  });
  app.post('/api/projects/:id/change-orders', owner, (request, response) => {
    const project = projectOrThrow(request.params.id as string),
      input = orderInput.parse(request.body),
      analysis = store.analysis(input.analysisId);
    if (!analysis || analysis.projectId !== project.id)
      throw new AppError(404, 'ANALYSIS_NOT_FOUND', 'Scope analysis not found for this project.');
    const changeOrder = newOrder(project, analysis, input);
    store.put('order', changeOrder);
    store.audit(project.id, {
      changeOrderId: changeOrder.id,
      type: 'proposal_created',
      title: 'Change order drafted',
      detail: `${changeOrder.items.length} additional-work line(s), ${(changeOrder.amountCents / 100).toFixed(2)} ${changeOrder.currency}. Included work remains in the original fee.`,
      actor: 'Freelancer',
    });
    response.status(201).json({ changeOrder });
  });
  app.patch('/api/change-orders/:id', owner, (request, response) => {
    const order = orderOrThrow(request.params.id as string);
    requireDraft(order);
    const input = patchOrderInput.parse(request.body),
      project = projectOrThrow(order.projectId),
      analysis = store.analysis(order.analysisId)!;
    if (input.items) {
      order.items = buildLines(analysis, project, { items: input.items });
      order.amountCents = order.items.reduce((sum, item) => sum + item.amountCents, 0);
    }
    if (input.title) order.title = input.title;
    if (input.summary) order.summary = input.summary;
    order.revision++;
    order.updatedAt = new Date().toISOString();
    store.put('order', order);
    response.json({ changeOrder: order });
  });
  app.post('/api/change-orders/:id/share', owner, (request, response) => {
    const order = orderOrThrow(request.params.id as string);
    if (order.status === 'draft') {
      const analysis = store.analysis(order.analysisId);
      if (!analysis || sourceHash(projectOrThrow(order.projectId)) !== analysis.sourceHash)
        throw new AppError(
          409,
          'STALE_ANALYSIS',
          'The brief, messages, or hourly rate changed after this draft was created. Analyze the latest sources and create a new proposal before sharing.',
        );
      order.status = 'sent';
      order.reviewToken = randomBytes(32).toString('hex');
      order.termsHash = termsHash(order);
      order.sharedAt = new Date().toISOString();
      order.updatedAt = order.sharedAt;
      order.reviewUrl = `${allowedOrigin}/review/${order.reviewToken}`;
      store.put('order', order);
      store.audit(order.projectId, {
        changeOrderId: order.id,
        type: 'proposal_shared',
        title: 'Client review link created',
        detail: `Revision ${order.revision} is locked for client review. Scope and price fingerprint: ${order.termsHash.slice(0, 16)}.`,
        actor: 'Freelancer',
      });
    }
    response.json({ changeOrder: order, reviewUrl: order.reviewUrl });
  });
  app.get('/api/review/:token', (request, response) =>
    response.json(reviewDetail(reviewOrThrow(request.params.token as string))),
  );
  app.post('/api/review/:token/decision', (request, response) => {
    const order = reviewOrThrow(request.params.token as string),
      input = z
        .object({
          decision: z.enum(['accept', 'decline']),
          name: z.string().trim().min(1).max(120),
          note: z.string().trim().max(2000).optional(),
          termsHash: z.string().optional(),
        })
        .parse(request.body);
    if (
      (input.decision === 'accept' &&
        ['accepted', 'invoiced', 'partially_paid', 'paid'].includes(order.status)) ||
      (input.decision === 'decline' && order.status === 'declined')
    )
      return response.json({ changeOrder: safeOrder(order) });
    if (order.status !== 'sent')
      throw new AppError(
        409,
        'ALREADY_DECIDED',
        'This proposal already has a decision. Ask the freelancer for a new proposal if the terms need to change.',
      );
    if (
      !order.termsHash ||
      termsHash(order) !== order.termsHash ||
      (input.termsHash && input.termsHash !== order.termsHash)
    )
      throw new AppError(
        409,
        'TERMS_CHANGED',
        'The proposal fingerprint no longer matches the reviewed terms. Refresh before deciding.',
      );
    order.status = input.decision === 'accept' ? 'accepted' : 'declined';
    order.updatedAt = new Date().toISOString();
    order.clientNote = input.note;
    if (input.decision === 'accept') {
      order.acceptedAt = order.updatedAt;
      order.acceptedBy = input.name;
    } else order.declinedAt = order.updatedAt;
    store.put('order', order);
    store.audit(order.projectId, {
      changeOrderId: order.id,
      type: input.decision === 'accept' ? 'proposal_accepted' : 'proposal_declined',
      title:
        input.decision === 'accept'
          ? 'Client approved the change'
          : 'Client requested a different proposal',
      detail: `${input.name} ${input.decision === 'accept' ? 'approved' : 'declined'} revision ${order.revision} for ${(order.amountCents / 100).toFixed(2)} ${order.currency}.${input.note ? ` Note: ${input.note}` : ''}`,
      actor: input.name,
    });
    response.json({ changeOrder: safeOrder(order) });
  });
  app.post('/api/change-orders/:id/invoice', owner, async (request, response) => {
    const changeOrder = await locked(request.params.id as string, async () => {
      const order = orderOrThrow(request.params.id as string);
      if (!['accepted', 'invoiced', 'partially_paid', 'paid'].includes(order.status))
        throw new AppError(
          409,
          'ACCEPTANCE_REQUIRED',
          'The client must approve this exact proposal before an invoice can be created.',
        );
      if (!order.acceptedAt || termsHash(order) !== order.termsHash)
        throw new AppError(
          409,
          'TERMS_CHANGED',
          'Approved terms failed the integrity check. No invoice was created.',
        );
      if (!order.invoice) {
        order.invoice = await paypal.createInvoice(projectOrThrow(order.projectId), order);
        if (
          order.invoice.amountCents !== order.amountCents ||
          order.invoice.currency !== order.currency
        )
          throw new AppError(
            409,
            'INVOICE_AMOUNT_MISMATCH',
            'PayPal invoice total or currency does not match the accepted terms.',
          );
        store.put('order', order);
        store.audit(order.projectId, {
          changeOrderId: order.id,
          type: 'invoice_created',
          title: 'PayPal sandbox invoice created',
          detail: `Invoice ${order.invoice.id} bills only the approved additional work.`,
          actor: 'Freelancer',
        });
      }
      if (order.invoice.status === 'DRAFT') await paypal.sendInvoice(order.invoice.id);
      return sync(order, 'PayPal sandbox API');
    });
    response.json({ changeOrder });
  });
  app.post('/api/change-orders/:id/sync', owner, async (request, response) =>
    response.json({
      changeOrder: await locked(request.params.id as string, () =>
        sync(orderOrThrow(request.params.id as string), 'PayPal sandbox API'),
      ),
    }),
  );
  app.post('/api/review/:token/sync', async (request, response) => {
    const order = reviewOrThrow(request.params.token as string);
    const changeOrder = await locked(order.id, () =>
      sync(orderOrThrow(order.id), 'Client payment refresh'),
    );
    response.json({ changeOrder: safeOrder(changeOrder) });
  });
  app.post('/api/webhooks/paypal', async (request, response) => {
    // PayPal verifies the complete original event. Do not strip signed top-level
    // metadata such as create_time, resource_type, summary, links or event_version.
    const event = z
      .object({
        id: z.string().min(1).max(200),
        event_type: z.string().max(200),
        resource: z.record(z.string(), z.unknown()),
      })
      .passthrough()
      .parse(request.body);
    const headers = Object.fromEntries(
      Object.entries(request.headers).map(([key, value]) => [
        key,
        Array.isArray(value) ? value[0] : value,
      ]),
    );
    if (!(await paypal.verifyWebhook(headers, event)))
      throw new AppError(401, 'INVALID_WEBHOOK', 'PayPal webhook signature verification failed.');
    if (store.hasWebhook(event.id)) return response.json({ received: true, duplicate: true });
    const invoiceId = String(event.resource.invoice_id || event.resource.id || '');
    const order = store.orderByInvoice(invoiceId);
    if (order && event.event_type.startsWith('INVOICING.'))
      await locked(order.id, () =>
        sync(orderOrThrow(order.id), 'Verified PayPal webhook', event.id),
      );
    else store.recordWebhook(event.id);
    response.json({ received: true });
  });
  app.get('/api/projects/:id/export', owner, (request, response) => {
    const projectDetail = detail(request.params.id as string);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="changeorder-evidence-${projectDetail.project.id}.json"`,
    );
    response.json({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      environment: 'PayPal sandbox',
      ...projectDetail,
    });
  });
  app.use('/api', (_request, _response, next) =>
    next(new AppError(404, 'NOT_FOUND', 'API endpoint not found.')),
  );
  const dist = resolve(process.cwd(), 'dist');
  if (existsSync(resolve(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get('/{*path}', (_request, response) => response.sendFile(resolve(dist, 'index.html')));
  }
  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof AppError)
      return response.status(error.status).json({ error: error.message, code: error.code });
    if (error instanceof z.ZodError)
      return response.status(400).json({
        error: error.issues
          .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
          .slice(0, 5)
          .join('; '),
        code: 'INVALID_INPUT',
      });
    if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large')
      return response.status(413).json({
        error: 'This request is too large. Shorten the brief or submit fewer messages at a time.',
        code: 'REQUEST_TOO_LARGE',
      });
    if (error instanceof SyntaxError)
      return response
        .status(400)
        .json({ error: 'The request body must contain valid JSON.', code: 'INVALID_JSON' });
    response.status(500).json({
      error: 'The request could not be completed. No payment state has been assumed. Please retry.',
      code: 'INTERNAL_ERROR',
    });
  });
  return { app, store };
}
