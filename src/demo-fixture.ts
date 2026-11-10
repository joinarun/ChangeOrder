// Shared synthetic sources for the explicitly prewritten sample walkthrough.
// Keep this module free of server dependencies so the public sample uses the
// same applicability rule as the local API.
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

export const DEMO_REQUEST_TEXTS = [
  'Could you change the hero headline to “A better way to launch”? This is one of the two copy revisions.',
  'Could you also add a mobile checkout flow with payment confirmation? We would love customers to buy directly from their phones.',
  'Can we launch next Friday, or do you need more time?',
] as const;

export function matchesDemoSources(project: { brief: string; messages: { text: string }[] }) {
  return (
    project.brief === DEMO_BRIEF &&
    project.messages.length === DEMO_REQUEST_TEXTS.length &&
    DEMO_REQUEST_TEXTS.every((text) => project.messages.some((message) => message.text === text))
  );
}
