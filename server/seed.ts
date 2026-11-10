import { randomUUID } from 'node:crypto';
import type { Analysis, Project } from './types.js';
import { AppError, sourceHash, validateEvidence } from './domain.js';

export const DEMO_BRIEF = `PROJECT: Orbit Studio landing page
Fixed project fee: $300 USD.

AGREED DELIVERABLES
One desktop marketing landing page with a hero, benefits section, and contact form.
Two rounds of headline and body copy revisions are included.
Delivery includes the source files and a deployment handoff.

OUTSIDE THIS AGREEMENT
E-commerce, payment processing, mobile checkout, and additional pages are excluded.
Additional work requires a separately approved change order at $60 per hour.

TIMELINE
Target delivery: Friday, subject to final content approval.`;
export function seedProject(): Project {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    title: 'Orbit Studio website',
    clientName: 'Jamie Chen',
    clientEmail: process.env.PAYPAL_SANDBOX_BUYER_EMAIL || 'jamie@example.com',
    freelancerName: 'Alex Morgan',
    currency: 'USD',
    baseAmountCents: 30000,
    hourlyRateCents: 6000,
    brief: DEMO_BRIEF,
    messages: [
      {
        id: randomUUID(),
        author: 'Jamie',
        text: 'Could you change the hero headline to “A better way to launch”? This is one of the two copy revisions.',
        createdAt: now,
      },
      {
        id: randomUUID(),
        author: 'Jamie',
        text: 'Could you also add a mobile checkout flow with payment confirmation? We would love customers to buy directly from their phones.',
        createdAt: now,
      },
      {
        id: randomUUID(),
        author: 'Jamie',
        text: 'Can we launch next Friday, or do you need more time?',
        createdAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}
export function sampleAnalysis(project: Project): Analysis {
  const change = project.messages.find((message) =>
    message.text.includes('Could you also add a mobile checkout flow with payment confirmation?'),
  );
  const included = project.messages.find((message) =>
    message.text.includes('This is one of the two copy revisions.'),
  );
  const clarify = project.messages.find((message) =>
    message.text.includes('Can we launch next Friday, or do you need more time?'),
  );
  if (
    !project.brief.includes(
      'E-commerce, payment processing, mobile checkout, and additional pages are excluded.',
    ) ||
    !change ||
    !included ||
    !clarify
  )
    throw new AppError(
      400,
      'SAMPLE_NOT_APPLICABLE',
      'Sample analysis works with the supplied Orbit Studio story. Use live analysis for your own sources.',
    );
  const analysis: Analysis = {
    id: randomUUID(),
    projectId: project.id,
    mode: 'sample',
    model: 'Sample walkthrough · prewritten findings',
    createdAt: new Date().toISOString(),
    sourceHash: sourceHash(project),
    summary:
      'One request adds paid work, one is already included, and the launch date needs confirmation. Only the mobile checkout belongs in a change order.',
    items: [
      {
        id: randomUUID(),
        title: 'Mobile checkout and payment confirmation',
        description:
          'Add a mobile checkout flow and a payment-confirmation screen to the landing page.',
        classification: 'change',
        reason:
          'The agreement explicitly excludes mobile checkout and payment processing. The client now requests both capabilities.',
        confidence: 'high',
        estimatedHours: 2,
        suggestedAmountCents: Math.round(2 * project.hourlyRateCents),
        questions: [],
        evidence: [
          {
            sourceType: 'brief',
            sourceId: project.id,
            label: 'Original agreement · exclusions',
            quote:
              'E-commerce, payment processing, mobile checkout, and additional pages are excluded.',
          },
          {
            sourceType: 'message',
            sourceId: change.id,
            label: 'Client request',
            quote: 'Could you also add a mobile checkout flow with payment confirmation?',
          },
        ],
      },
      {
        id: randomUUID(),
        title: 'Hero headline revision',
        description: 'Update the hero headline within the agreed copy revisions.',
        classification: 'included',
        reason:
          'Two copy revision rounds are already included in the fixed fee. This request should not create an additional charge.',
        confidence: 'high',
        estimatedHours: 0,
        suggestedAmountCents: 0,
        questions: [],
        evidence: [
          {
            sourceType: 'brief',
            sourceId: project.id,
            label: 'Original agreement · included work',
            quote: 'Two rounds of headline and body copy revisions are included.',
          },
          {
            sourceType: 'message',
            sourceId: included.id,
            label: 'Client request',
            quote: 'This is one of the two copy revisions.',
          },
        ],
      },
      {
        id: randomUUID(),
        title: 'Confirm the launch date',
        description:
          'Confirm whether next Friday remains achievable after agreeing the extra work.',
        classification: 'clarification',
        reason: 'A scheduling question does not by itself authorize a rush fee or additional work.',
        confidence: 'medium',
        estimatedHours: 0,
        suggestedAmountCents: 0,
        questions: ['Does the additional checkout change the delivery date?'],
        evidence: [
          {
            sourceType: 'brief',
            sourceId: project.id,
            label: 'Original agreement · timeline',
            quote: 'Target delivery: Friday, subject to final content approval.',
          },
          {
            sourceType: 'message',
            sourceId: clarify.id,
            label: 'Client question',
            quote: 'Can we launch next Friday, or do you need more time?',
          },
        ],
      },
    ],
  };
  validateEvidence(project, analysis.items);
  return analysis;
}
