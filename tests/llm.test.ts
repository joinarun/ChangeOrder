import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWithLLM } from '../server/llm.js';
import { seedProject } from '../server/seed.js';

test('live analyzer uses the configured proxy and validates restored, exact source quotations', async () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = {
    base: process.env.LLM_PROXY_BASE_URL,
    token: process.env.LLM_PROXY_ACCESS_TOKEN,
    model: process.env.LLM_MODEL,
  };
  process.env.LLM_PROXY_BASE_URL = 'https://proxy.example/openai/v1';
  process.env.LLM_PROXY_ACCESS_TOKEN = 'test-token-not-a-real-secret';
  process.env.LLM_MODEL = 'gpt-4.1';
  const project = seedProject();
  project.brief += `\nContact ${project.clientName} at ${project.clientEmail}.`;
  let returnedQuote =
    'E-commerce, payment processing, mobile checkout, and additional pages are excluded.';
  let sent = false;
  globalThis.fetch = async (url, options) => {
    sent = true;
    assert.equal(url, 'https://proxy.example/openai/v1/chat/completions');
    const headers = options!.headers as Record<string, string>;
    assert.equal(headers['x-cisco-app'], 'changeorder');
    assert.match(headers.TrackingId!, /^CHANGEORDER_/);
    const body = JSON.parse(options!.body as string);
    assert.equal(body.model, 'gpt-4.1');
    assert.equal(body.messages[1].content.includes(project.clientEmail), false);
    assert.equal(body.messages[1].content.includes(project.clientName), false);
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: 'Checkout adds scope.',
                items: [
                  {
                    title: 'Mobile checkout',
                    description: 'Add checkout.',
                    classification: 'change',
                    reason: 'Explicitly excluded by the brief.',
                    confidence: 'high',
                    estimatedHours: 2,
                    questions: [],
                    evidence: [
                      {
                        sourceType: 'brief',
                        sourceId: project.id,
                        quote: returnedQuote,
                        label: 'Agreement',
                      },
                      {
                        sourceType: 'message',
                        sourceId: project.messages[1]!.id,
                        quote:
                          'Could you also add a mobile checkout flow with payment confirmation?',
                        label: 'Request',
                      },
                    ],
                  },
                ],
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };
  try {
    const analysis = await analyzeWithLLM(project);
    assert.equal(sent, true);
    assert.equal(analysis.mode, 'live');
    assert.equal(analysis.items[0]!.suggestedAmountCents, 12000);
    returnedQuote = 'The customer approved an extra payment.';
    await assert.rejects(() => analyzeWithLLM(project), /quotation could not be verified/);
    globalThis.fetch = async () => new Response('{}', { status: 401 });
    await assert.rejects(() => analyzeWithLLM(project), /HTTP 401/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnv.base === undefined) delete process.env.LLM_PROXY_BASE_URL;
    else process.env.LLM_PROXY_BASE_URL = originalEnv.base;
    if (originalEnv.token === undefined) delete process.env.LLM_PROXY_ACCESS_TOKEN;
    else process.env.LLM_PROXY_ACCESS_TOKEN = originalEnv.token;
    if (originalEnv.model === undefined) delete process.env.LLM_MODEL;
    else process.env.LLM_MODEL = originalEnv.model;
  }
});
