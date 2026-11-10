import { z } from 'zod';
import {
  DEMO_BRIEF as BRIEF,
  DEMO_REQUEST_TEXTS as REQUESTS,
  matchesDemoSources,
} from './demo-fixture';
import type {
  Analysis,
  AnalysisItem,
  AuditEvent,
  ChangeOrder,
  ChangeOrderLine,
  Project,
  ReviewDetail,
  SessionState,
} from '../server/types';

/** This adapter is a browser-local sample, never a payment or model gateway. */
export const DEMO_STORAGE_KEY = 'changeorder-public-sample-v1';
export const DEMO_SOURCE = 'Browser sample · prewritten findings';
const LOCAL_BUILD =
  'This public sample has no live AI or payment connection. Run the local build with your own AI and PayPal sandbox credentials to use those integrations.';
const FIXTURE_ONLY =
  'Prewritten analysis is available only for the supplied Orbit Studio example. Use the local build with Live AI for your own brief and requests.';

type DemoState = {
  version: 1;
  projects: Project[];
  analyses: Analysis[];
  orders: ChangeOrder[];
  audit: AuditEvent[];
};
type DemoStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type DemoOptions = { storage: DemoStorage; baseUrl: string };

const lineInput = z.object({
  analysisItemId: z.string().min(1),
  hours: z.number().positive().max(1000),
  rateCents: z.number().int().min(1).max(1_000_000),
});
const orderInput = z.object({
  analysisId: z.string().min(1),
  itemIds: z.array(z.string()).max(20).optional(),
  items: z.array(lineInput).min(1).max(20).optional(),
  title: z.string().trim().min(1).max(180).optional(),
  summary: z.string().trim().min(1).max(3000).optional(),
});
const patchInput = orderInput.omit({ analysisId: true, itemIds: true }).partial();
const decisionInput = z.object({
  decision: z.enum(['accept', 'decline']),
  name: z.string().trim().min(1).max(120),
  note: z.string().trim().max(2000).optional(),
  termsHash: z.string().min(1),
});

function id() {
  return crypto.randomUUID();
}
function timestamp() {
  return new Date().toISOString();
}
async function digest(value: unknown) {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function sourceHash(project: Project) {
  return digest({
    brief: project.brief,
    messages: project.messages,
    hourlyRateCents: project.hourlyRateCents,
  });
}
function termsHash(order: ChangeOrder) {
  return digest({
    id: order.id,
    title: order.title,
    summary: order.summary,
    items: order.items,
    amountCents: order.amountCents,
    currency: order.currency,
    revision: order.revision,
    clientName: order.clientName,
    clientEmail: order.clientEmail,
    originalAmountCents: order.originalAmountCents,
    sourceSnapshot: order.sourceSnapshot,
  });
}
function seedProject(): Project {
  const now = timestamp();
  return {
    id: id(),
    title: 'Orbit Studio website',
    clientName: 'Jamie Chen',
    clientEmail: 'jamie@example.com',
    freelancerName: 'Alex Morgan',
    currency: 'USD',
    baseAmountCents: 30000,
    hourlyRateCents: 6000,
    brief: BRIEF,
    messages: REQUESTS.map((text) => ({ id: id(), author: 'Jamie', text, createdAt: now })),
    createdAt: now,
    updatedAt: now,
  };
}
function addAudit(
  state: DemoState,
  projectId: string,
  event: Omit<AuditEvent, 'id' | 'projectId' | 'createdAt'>,
) {
  state.audit.unshift({ ...event, id: id(), projectId, createdAt: timestamp() });
}
function addExample(state: DemoState) {
  const project = seedProject();
  state.projects.unshift(project);
  addAudit(state, project.id, {
    type: 'project_created',
    title: 'Browser sample ready',
    detail:
      'Fictional $300 agreement and three supplied requests. Saved only in this browser; no AI or payment API has been called.',
    actor: 'Sample walkthrough',
  });
  return project;
}
function freshState(): DemoState {
  const state: DemoState = { version: 1, projects: [], analyses: [], orders: [], audit: [] };
  addExample(state);
  return state;
}
function validateEvidence(project: Project, items: AnalysisItem[]) {
  for (const item of items) {
    if (!item.evidence.length) throw new Error('A finding must include exact source evidence.');
    for (const evidence of item.evidence) {
      const source =
        evidence.sourceType === 'brief'
          ? evidence.sourceId === project.id
            ? project.brief
            : undefined
          : project.messages.find((message) => message.id === evidence.sourceId)?.text;
      if (!source || !evidence.quote.trim() || !source.includes(evidence.quote))
        throw new Error('Source evidence no longer matches the example. Reset the browser sample.');
    }
  }
}
async function sampleAnalysis(project: Project): Promise<Analysis> {
  // Matching the complete fixture prevents prewritten output being used for changed requests.
  if (!matchesDemoSources(project)) throw new Error(FIXTURE_ONLY);
  const evidence = (index: number, briefQuote: string, requestQuote: string) => [
    {
      sourceType: 'brief' as const,
      sourceId: project.id,
      label: 'Original agreement',
      quote: briefQuote,
    },
    {
      sourceType: 'message' as const,
      sourceId: project.messages.find((message) => message.text === REQUESTS[index])!.id,
      label: 'Client request',
      quote: requestQuote,
    },
  ];
  const items: AnalysisItem[] = [
    {
      id: id(),
      title: 'Mobile checkout and payment confirmation',
      description:
        'Add a mobile checkout flow and a payment-confirmation screen to the landing page.',
      classification: 'change',
      confidence: 'high',
      estimatedHours: 2,
      suggestedAmountCents: Math.round(2 * project.hourlyRateCents),
      questions: [],
      reason:
        'The agreement explicitly excludes mobile checkout and payment processing. The client now requests both capabilities.',
      evidence: evidence(
        1,
        'E-commerce, payment processing, mobile checkout, and additional pages are excluded.',
        'Could you also add a mobile checkout flow with payment confirmation?',
      ),
    },
    {
      id: id(),
      title: 'Hero headline revision',
      description: 'Update the hero headline within the agreed copy revisions.',
      classification: 'included',
      confidence: 'high',
      estimatedHours: 0,
      suggestedAmountCents: 0,
      questions: [],
      reason:
        'Two copy revision rounds are already included in the fixed fee. This request should not create an additional charge.',
      evidence: evidence(
        0,
        'Two rounds of headline and body copy revisions are included.',
        'This is one of the two copy revisions.',
      ),
    },
    {
      id: id(),
      title: 'Confirm the launch date',
      description: 'Confirm whether next Friday remains achievable after agreeing the extra work.',
      classification: 'clarification',
      confidence: 'medium',
      estimatedHours: 0,
      suggestedAmountCents: 0,
      questions: ['Does the additional checkout change the delivery date?'],
      reason: 'A scheduling question does not by itself authorize a rush fee or additional work.',
      evidence: evidence(
        2,
        'Target delivery: Friday, subject to final content approval.',
        REQUESTS[2],
      ),
    },
  ];
  validateEvidence(project, items);
  return {
    id: id(),
    projectId: project.id,
    mode: 'sample',
    model: DEMO_SOURCE,
    createdAt: timestamp(),
    sourceHash: await sourceHash(project),
    items,
    summary:
      'One request adds paid work, one is already included, and the launch date needs confirmation. Only the mobile checkout belongs in a change order.',
  };
}
function buildLines(
  analysis: Analysis,
  project: Project,
  input: z.infer<typeof patchInput> & { itemIds?: string[] },
): ChangeOrderLine[] {
  const selected =
    input.items ||
    (
      input.itemIds ||
      analysis.items.filter((item) => item.classification === 'change').map((item) => item.id)
    ).map((itemId) => ({
      analysisItemId: itemId,
      hours: analysis.items.find((item) => item.id === itemId)?.estimatedHours || 0,
      rateCents: project.hourlyRateCents,
    }));
  if (
    !selected.length ||
    selected.length > 20 ||
    new Set(selected.map((line) => line.analysisItemId)).size !== selected.length
  )
    throw new Error('Choose between one and twenty distinct additional-work findings.');
  return selected.map((line) => {
    const item = analysis.items.find((candidate) => candidate.id === line.analysisItemId);
    if (!item || item.classification !== 'change')
      throw new Error('Included work and clarification cannot be charged.');
    lineInput.parse(line);
    const amountCents = Math.round(line.hours * line.rateCents);
    if (!Number.isSafeInteger(amountCents) || amountCents < 1)
      throw new Error('Each line must cost at least one cent.');
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      hours: line.hours,
      rateCents: line.rateCents,
      amountCents,
      evidence: structuredClone(item.evidence),
    };
  });
}
function safeOrder(order: ChangeOrder) {
  const {
    clientEmail: _clientEmail,
    sourceSnapshot: _sources,
    reviewToken: _token,
    ...publicOrder
  } = order;
  return structuredClone(publicOrder);
}
const session: SessionState = {
  authorized: true,
  authRequired: false,
  integrations: {
    llm: {
      configured: false,
      model: 'Prewritten Orbit Studio example',
      provider: 'Browser sample (no model calls)',
    },
    paypal: { configured: false, environment: 'sandbox', webhookConfigured: false },
  },
};

export function createDemoApi({ storage, baseUrl }: DemoOptions) {
  const read = (): DemoState => {
    const raw = storage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      try {
        const value = JSON.parse(raw) as DemoState;
        if (
          value.version === 1 &&
          Array.isArray(value.projects) &&
          Array.isArray(value.analyses) &&
          Array.isArray(value.orders) &&
          Array.isArray(value.audit) &&
          value.orders.every(
            (order) =>
              ['draft', 'sent', 'accepted', 'declined'].includes(order.status) && !order.invoice,
          ) &&
          value.analyses.every(
            (analysis) => analysis.mode === 'sample' && analysis.model === DEMO_SOURCE,
          )
        )
          return value;
      } catch {
        /* A reset recovers corrupt or obsolete browser-only data. */
      }
      throw new Error('This browser sample could not be read. Use Reset sample to start again.');
    }
    const state = freshState();
    storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    return state;
  };
  const save = (state: DemoState) => {
    try {
      storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
    } catch {
      throw new Error(
        'The browser could not save this sample. Allow local storage or reset the sample.',
      );
    }
  };
  const route = async (path: string, options: RequestInit = {}) => {
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? (JSON.parse(String(options.body)) as unknown) : {};
    const parts = path
      .replace(/^\/api(?=\/)/, '')
      .split('/')
      .filter(Boolean)
      .map(decodeURIComponent);
    if (parts[0] === 'session') return structuredClone(session);
    if (parts[0] === 'health')
      return {
        ok: true,
        app: 'ChangeOrder',
        environment: 'browser-sample',
        integrations: structuredClone(session.integrations),
      };
    if (parts[0] === 'webhooks' || parts.at(-1) === 'invoice' || parts.at(-1) === 'sync')
      throw new Error(LOCAL_BUILD);
    const state = read();
    const projectById = (projectId: string) => {
      const project = state.projects.find((candidate) => candidate.id === projectId);
      if (!project)
        throw new Error('This example project is unavailable. Reset the browser sample.');
      return project;
    };
    const orderById = (orderId: string) => {
      const order = state.orders.find((candidate) => candidate.id === orderId);
      if (!order)
        throw new Error('This example proposal is unavailable. Reset the browser sample.');
      return order;
    };
    if (parts[0] === 'projects' && parts.length === 1 && method === 'GET')
      return { projects: structuredClone(state.projects) };
    if (parts[0] === 'projects' && parts[1] === 'seed' && method === 'POST') {
      const project = addExample(state);
      save(state);
      return { project: structuredClone(project) };
    }
    if (parts[0] === 'projects' && parts.length === 1 && method === 'POST')
      throw new Error(FIXTURE_ONLY);
    if (parts[0] === 'projects' && parts[1]) {
      const project = projectById(parts[1]);
      if (parts.length === 2 && method === 'GET')
        return {
          project: structuredClone(project),
          analysis: structuredClone(
            state.analyses.filter((analysis) => analysis.projectId === project.id).at(-1) || null,
          ),
          changeOrders: structuredClone(
            state.orders.filter((order) => order.projectId === project.id),
          ),
          audit: structuredClone(state.audit.filter((event) => event.projectId === project.id)),
        };
      if ((parts.length === 2 && method === 'PATCH') || parts[2] === 'messages')
        throw new Error(FIXTURE_ONLY);
      if (parts[2] === 'analyze' && method === 'POST') {
        const input = z.object({ mode: z.enum(['sample', 'live']).default('live') }).parse(body);
        if (input.mode !== 'sample') throw new Error(LOCAL_BUILD);
        const analysis = await sampleAnalysis(project);
        state.analyses.push(analysis);
        addAudit(state, project.id, {
          type: 'scope_analyzed',
          title: 'Prewritten sample analysis loaded',
          detail:
            'Three supplied findings. Exact source quotations checked locally; no model API was called.',
          actor: 'Sample walkthrough',
        });
        save(state);
        return { analysis: structuredClone(analysis) };
      }
      if (parts[2] === 'change-orders' && method === 'POST') {
        const input = orderInput.parse(body);
        const analysis = state.analyses.find(
          (candidate) => candidate.id === input.analysisId && candidate.projectId === project.id,
        );
        if (!analysis) throw new Error('Review the supplied example before preparing a proposal.');
        if ((await sourceHash(project)) !== analysis.sourceHash)
          throw new Error('Sources changed. Review the example again before proposing work.');
        validateEvidence(project, analysis.items);
        const items = buildLines(analysis, project, input),
          now = timestamp();
        const order: ChangeOrder = {
          id: id(),
          projectId: project.id,
          analysisId: analysis.id,
          title: input.title || 'Additional work proposal',
          summary:
            input.summary ||
            'The following work extends our original agreement. Please review the scope and price before accepting.',
          items,
          amountCents: items.reduce((sum, item) => sum + item.amountCents, 0),
          currency: 'USD',
          status: 'draft',
          revision: 1,
          createdAt: now,
          updatedAt: now,
          clientName: project.clientName,
          clientEmail: project.clientEmail,
          freelancerName: project.freelancerName,
          projectTitle: project.title,
          originalAmountCents: project.baseAmountCents,
          sourceSnapshot: { brief: project.brief, messages: structuredClone(project.messages) },
        };
        state.orders.unshift(order);
        addAudit(state, project.id, {
          changeOrderId: order.id,
          type: 'proposal_created',
          title: 'Sample change order drafted',
          detail: `${(order.amountCents / 100).toFixed(2)} USD in additional work. Included work remains in the original fee.`,
          actor: 'Freelancer (sample)',
        });
        save(state);
        return { changeOrder: structuredClone(order) };
      }
      if (parts[2] === 'export' && method === 'GET')
        return structuredClone({
          project,
          analyses: state.analyses.filter((analysis) => analysis.projectId === project.id),
          changeOrders: state.orders.filter((order) => order.projectId === project.id),
          audit: state.audit.filter((event) => event.projectId === project.id),
          demo: true,
        });
    }
    if (parts[0] === 'change-orders' && parts[1]) {
      const order = orderById(parts[1]);
      if (parts.length === 2 && method === 'PATCH') {
        if (order.status !== 'draft')
          throw new Error('Shared terms are immutable. Create a new proposal for different terms.');
        const input = patchInput.parse(body);
        const analysis = state.analyses.find((candidate) => candidate.id === order.analysisId)!;
        const project = projectById(order.projectId);
        if ((await sourceHash(project)) !== analysis.sourceHash)
          throw new Error('Sources changed. Review the example again before revising the draft.');
        validateEvidence(project, analysis.items);
        if (input.items) {
          order.items = buildLines(analysis, project, input);
          order.amountCents = order.items.reduce((sum, item) => sum + item.amountCents, 0);
        }
        if (input.title) order.title = input.title;
        if (input.summary) order.summary = input.summary;
        order.revision++;
        order.updatedAt = timestamp();
        save(state);
        return { changeOrder: structuredClone(order) };
      }
      if (parts[2] === 'share' && method === 'POST') {
        if (order.status === 'draft') {
          order.status = 'sent';
          order.reviewToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
            byte.toString(16).padStart(2, '0'),
          ).join('');
          order.termsHash = await termsHash(order);
          order.sharedAt = timestamp();
          order.updatedAt = order.sharedAt;
          const url = new URL(baseUrl);
          url.search = '';
          url.hash = '';
          url.searchParams.set('review', order.reviewToken);
          order.reviewUrl = url.href;
          addAudit(state, order.projectId, {
            changeOrderId: order.id,
            type: 'proposal_shared',
            title: 'Sample terms locked for review',
            detail: `Version ${order.revision}. This review works only in tabs using the same browser storage.`,
            actor: 'Freelancer (sample)',
          });
          save(state);
        }
        return { changeOrder: structuredClone(order), reviewUrl: order.reviewUrl };
      }
    }
    if (parts[0] === 'review' && parts[1]) {
      const order = state.orders.find(
        (candidate) => candidate.reviewToken === parts[1] && candidate.status !== 'draft',
      );
      if (!order)
        throw new Error(
          'This sample review belongs to another browser or was reset. Open a new example in this browser.',
        );
      if (parts.length === 2 && method === 'GET')
        return {
          project: {
            id: order.projectId,
            title: order.projectTitle,
            clientName: order.clientName,
            freelancerName: order.freelancerName,
            currency: order.currency,
            baseAmountCents: order.originalAmountCents || 0,
          },
          changeOrder: safeOrder(order),
          evidence: structuredClone(order.items.flatMap((item) => item.evidence)),
          audit: structuredClone(state.audit.filter((event) => event.changeOrderId === order.id)),
        } as ReviewDetail;
      if (parts[2] === 'decision' && method === 'POST') {
        const input = decisionInput.parse(body);
        if (
          !order.termsHash ||
          input.termsHash !== order.termsHash ||
          (await termsHash(order)) !== order.termsHash
        )
          throw new Error(
            'The scope or price differs from the reviewed terms. Reload this sample proposal before deciding.',
          );
        if (
          (input.decision === 'accept' && order.status === 'accepted') ||
          (input.decision === 'decline' && order.status === 'declined')
        )
          return { changeOrder: safeOrder(order) };
        if (order.status !== 'sent')
          throw new Error(
            'This sample proposal already has a decision. Create a new proposal for different terms.',
          );
        order.status = input.decision === 'accept' ? 'accepted' : 'declined';
        order.updatedAt = timestamp();
        order.clientNote = input.note;
        if (input.decision === 'accept') {
          order.acceptedAt = order.updatedAt;
          order.acceptedBy = input.name;
        } else order.declinedAt = order.updatedAt;
        addAudit(state, order.projectId, {
          changeOrderId: order.id,
          type: input.decision === 'accept' ? 'proposal_accepted' : 'proposal_declined',
          title:
            input.decision === 'accept'
              ? 'Sample client approved the terms'
              : 'Sample client requested a revision',
          detail: `${input.name} ${input.decision === 'accept' ? 'approved' : 'declined'} version ${order.revision} for ${(order.amountCents / 100).toFixed(2)} USD. Browser demonstration only; no invoice or payment was created.`,
          actor: `${input.name} (sample)`,
        });
        save(state);
        return { changeOrder: safeOrder(order) };
      }
    }
    throw new Error(
      'This action is not available in the public browser sample. Use the local build for the complete integration.',
    );
  };
  // Calls from one app instance are serialized so a click cannot overtake its pending share.
  let pending: Promise<unknown> = Promise.resolve();
  return {
    api: async <T>(path: string, options: RequestInit = {}): Promise<T> => {
      const request = pending.catch(() => undefined).then(() => route(path, options));
      pending = request;
      return request as Promise<T>;
    },
    reset: () => {
      storage.removeItem(DEMO_STORAGE_KEY);
    },
  };
}

let browserDemo: ReturnType<typeof createDemoApi> | undefined;
function currentDemo() {
  browserDemo ||= createDemoApi({ storage: window.localStorage, baseUrl: window.location.href });
  return browserDemo;
}
export function demoApi<T>(path: string, options: RequestInit = {}) {
  return currentDemo().api<T>(path, options);
}
export function resetDemo() {
  currentDemo().reset();
}
