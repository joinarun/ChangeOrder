import test from 'node:test';
import assert from 'node:assert/strict';
import { seedProject, sampleAnalysis } from '../server/seed.js';
import { buildLines, newOrder, priceLine, termsHash, validateEvidence } from '../server/domain.js';
import { mapInvoice } from '../server/paypal.js';

test('analysis quotes must exist verbatim and cite the correct original source', () => {
  const project = seedProject(),
    analysis = sampleAnalysis(project);
  assert.doesNotThrow(() => validateEvidence(project, analysis.items));
  const forged = structuredClone(analysis.items);
  forged[0]!.evidence[0]!.quote = 'The client agreed to an unlimited budget.';
  assert.throws(() => validateEvidence(project, forged), /quotation could not be verified/);
  const wrongSource = structuredClone(analysis.items);
  wrongSource[0]!.evidence[0]!.sourceId = 'another-project';
  assert.throws(() => validateEvidence(project, wrongSource), /quotation could not be verified/);
});
test('included revisions and clarification requests cannot be charged', () => {
  const project = seedProject(),
    analysis = sampleAnalysis(project);
  for (const item of analysis.items.filter((item) => item.classification !== 'change')) {
    assert.throws(
      () => buildLines(analysis, project, { itemIds: [item.id] }),
      /Only findings classified as additional/,
    );
  }
});
test('money comes from reviewed hours and rates with deterministic cent rounding', () => {
  const project = seedProject(),
    analysis = sampleAnalysis(project),
    item = analysis.items[0]!;
  item.suggestedAmountCents = 99999999;
  assert.equal(priceLine(item, 2, 6000).amountCents, 12000);
  assert.equal(priceLine(item, 0.25, 3333).amountCents, 833);
  assert.throws(() => priceLine(item, -1, 6000));
  assert.throws(() => priceLine(item, 1, 12.5));
});
test('source changes invalidate analysis and accepted terms are bound to source and recipient', () => {
  const project = seedProject(),
    analysis = sampleAnalysis(project),
    order = newOrder(project, analysis, {});
  assert.equal(order.amountCents, 12000);
  const original = termsHash(order);
  order.clientEmail = 'different@example.com';
  assert.notEqual(termsHash(order), original);
  project.brief += '\nActually include checkout.';
  assert.throws(() => newOrder(project, analysis, {}), /Analyze the latest sources/);
});
test('invoice mapping distinguishes pending and partial payment from full settlement', () => {
  const pending = mapInvoice({
    id: 'INV2-TEST',
    status: 'PAYMENT_PENDING',
    amount: { value: '120.00', currency_code: 'USD' },
    payments: { paid_amount: { value: '0.00' } },
    due_amount: { value: '120.00' },
  });
  assert.equal(pending.paidAmountCents, 0);
  const partial = mapInvoice({
    id: 'INV2-TEST',
    status: 'PARTIALLY_PAID',
    amount: { value: '120.00', currency_code: 'USD' },
    payments: { paid_amount: { value: '40.00' } },
    due_amount: { value: '80.00' },
  });
  assert.equal(partial.paidAmountCents, 4000);
  const paid = mapInvoice({
    id: 'INV2-TEST',
    status: 'PAID',
    amount: { value: '120.00', currency_code: 'USD' },
    detail: { metadata: { recipient_view_url: 'https://evil.example/payment' } },
  });
  assert.equal(paid.paidAmountCents, 12000);
  assert.equal(paid.paymentUrl, undefined);
  assert.equal(paid.currency, 'USD');
  const inconsistent = mapInvoice({
    id: 'INV2-TEST',
    status: 'PAID',
    amount: { value: '120.00', currency_code: 'USD' },
    payments: { paid_amount: { value: '40.00' } },
  });
  assert.equal(inconsistent.paidAmountCents, 4000);
});
