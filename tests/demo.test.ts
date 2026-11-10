import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoApi, DEMO_STORAGE_KEY } from '../src/demo-api';
import type {
  Analysis,
  ChangeOrder,
  Project,
  ProjectDetail,
  ReviewDetail,
  SessionState,
} from '../server/types';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
const post = (body: unknown = {}) => ({ method: 'POST', body: JSON.stringify(body) });
async function example() {
  const storage = memoryStorage();
  const demo = createDemoApi({ storage, baseUrl: 'https://demo.example/ChangeOrder/?ignored=yes' });
  const {
    projects: [project],
  } = await demo.api<{ projects: Project[] }>('/projects');
  const { analysis } = await demo.api<{ analysis: Analysis }>(
    `/projects/${project.id}/analyze`,
    post({ mode: 'sample' }),
  );
  return { storage, demo, project, analysis };
}
async function proposal() {
  const result = await example();
  const { demo, project, analysis } = result;
  const { changeOrder } = await demo.api<{ changeOrder: ChangeOrder }>(
    `/projects/${project.id}/change-orders`,
    post({ analysisId: analysis.id }),
  );
  const { reviewUrl } = await demo.api<{ reviewUrl: string }>(
    `/change-orders/${changeOrder.id}/share`,
    post(),
  );
  const token = new URL(reviewUrl).searchParams.get('review')!;
  return { ...result, order: changeOrder, reviewUrl, token };
}

test('browser sample is isolated, explicitly prewritten, and cannot call live integrations', async () => {
  const { demo, storage, project, analysis } = await example();
  const session = await demo.api<SessionState>('/session');
  assert.equal(session.authorized, true);
  assert.equal(session.authRequired, false);
  assert.equal(session.integrations.llm.configured, false);
  assert.equal(session.integrations.paypal.configured, false);
  assert.equal(analysis.mode, 'sample');
  assert.match(analysis.model, /prewritten/);
  assert.deepEqual(
    analysis.items.map((item) => item.classification),
    ['change', 'included', 'clarification'],
  );
  for (const path of [
    `/projects/${project.id}/analyze`,
    '/change-orders/anything/invoice',
    '/review/anything/sync',
    '/webhooks/paypal',
  ]) {
    await assert.rejects(
      demo.api(path, post({ mode: 'live' })),
      /public sample.*no live AI or payment connection/,
    );
  }
  const otherBrowser = createDemoApi({
    storage: memoryStorage(),
    baseUrl: 'https://demo.example/ChangeOrder/',
  });
  await assert.rejects(otherBrowser.api(`/projects/${project.id}`), /unavailable/);
  const sameBrowserTab = createDemoApi({ storage, baseUrl: 'https://demo.example/ChangeOrder/' });
  assert.equal(
    (await sameBrowserTab.api<ProjectDetail>(`/projects/${project.id}`)).analysis?.id,
    analysis.id,
  );
});

test('browser sample prices only reviewed additions and locks shared client terms', async () => {
  const { demo, project, analysis } = await example();
  await assert.rejects(
    demo.api(
      `/projects/${project.id}/change-orders`,
      post({
        analysisId: analysis.id,
        itemIds: [analysis.items.find((item) => item.classification === 'included')!.id],
      }),
    ),
    /cannot be charged/,
  );
  const addition = analysis.items.find((item) => item.classification === 'change')!;
  const { changeOrder: draft } = await demo.api<{ changeOrder: ChangeOrder }>(
    `/projects/${project.id}/change-orders`,
    post({
      analysisId: analysis.id,
      items: [{ analysisItemId: addition.id, hours: 3.25, rateCents: 6000 }],
    }),
  );
  assert.equal(draft.amountCents, 19500);
  const { changeOrder: edited } = await demo.api<{ changeOrder: ChangeOrder }>(
    `/change-orders/${draft.id}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ items: [{ analysisItemId: addition.id, hours: 2, rateCents: 6000 }] }),
    },
  );
  assert.equal(edited.amountCents, 12000);
  const { changeOrder: shared, reviewUrl } = await demo.api<{
    changeOrder: ChangeOrder;
    reviewUrl: string;
  }>(`/change-orders/${draft.id}/share`, post());
  assert.equal(new URL(reviewUrl).pathname, '/ChangeOrder/');
  assert.equal(new URL(reviewUrl).searchParams.has('ignored'), false);
  const token = new URL(reviewUrl).searchParams.get('review')!;
  const review = await demo.api<ReviewDetail>(`/review/${token}`);
  assert.equal('clientEmail' in review.changeOrder, false);
  assert.equal('sourceSnapshot' in review.changeOrder, false);
  await assert.rejects(
    demo.api(`/change-orders/${draft.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Different terms' }),
    }),
    /immutable/,
  );
  await assert.rejects(
    demo.api(
      `/review/${token}/decision`,
      post({ decision: 'accept', name: 'Jamie', termsHash: 'wrong' }),
    ),
    /differs from the reviewed terms/,
  );
  const accepted = await demo.api<{ changeOrder: ChangeOrder }>(
    `/review/${token}/decision`,
    post({ decision: 'accept', name: 'Jamie', termsHash: shared.termsHash }),
  );
  assert.equal(accepted.changeOrder.status, 'accepted');
  assert.equal(accepted.changeOrder.invoice, undefined);
  await assert.rejects(
    demo.api(
      `/review/${token}/decision`,
      post({ decision: 'decline', name: 'Jamie', termsHash: shared.termsHash }),
    ),
    /already has a decision/,
  );
  const repeated = await demo.api<{ changeOrder: ChangeOrder }>(
    `/review/${token}/decision`,
    post({ decision: 'accept', name: 'Jamie', termsHash: shared.termsHash }),
  );
  assert.equal(repeated.changeOrder.acceptedAt, accepted.changeOrder.acceptedAt);
});

test('browser sample decline is final, review works across same-browser tabs, and reset is local', async () => {
  const { storage, demo, token, order } = await proposal();
  const clientTab = createDemoApi({ storage, baseUrl: 'https://demo.example/ChangeOrder/' });
  const review = await clientTab.api<ReviewDetail>(`/review/${token}`);
  await clientTab.api(
    `/review/${token}/decision`,
    post({
      decision: 'decline',
      name: 'Jamie',
      note: 'Please clarify the delivery date.',
      termsHash: review.changeOrder.termsHash,
    }),
  );
  const updated = await demo.api<ProjectDetail>(`/projects/${order.projectId}`);
  assert.equal(updated.changeOrders[0].status, 'declined');
  assert.equal(updated.changeOrders[0].clientNote, 'Please clarify the delivery date.');
  await assert.rejects(
    clientTab.api(
      `/review/${token}/decision`,
      post({ decision: 'accept', name: 'Jamie', termsHash: review.changeOrder.termsHash }),
    ),
    /already has a decision/,
  );
  demo.reset();
  await assert.rejects(clientTab.api(`/review/${token}`), /another browser or was reset/);
});

test('browser sample rejects amended sources and never displays a forged paid state', async () => {
  const { storage, demo, project } = await example();
  const changed = JSON.parse(storage.getItem(DEMO_STORAGE_KEY)!);
  changed.projects[0].brief += '\nAmendment: mobile checkout is included at no charge.';
  storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(changed));
  await assert.rejects(
    demo.api(`/projects/${project.id}/analyze`, post({ mode: 'sample' })),
    /only for the supplied Orbit Studio example/,
  );
  const other = await proposal();
  const tampered = JSON.parse(other.storage.getItem(DEMO_STORAGE_KEY)!);
  tampered.orders[0].status = 'paid';
  tampered.orders[0].invoice = { status: 'PAID' };
  other.storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(tampered));
  await assert.rejects(other.demo.api(`/review/${other.token}`), /Reset sample/);
});
