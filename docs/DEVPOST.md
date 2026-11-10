# ChangeOrder

## Elevator pitch

ChangeOrder helps freelancers turn changing client requests into clear, agreed, paid work. AI links each proposed scope change to the original brief and the client’s messages. Both people approve the extra work before a separate PayPal invoice collects payment.

## Inspiration

A project often starts with a clear price and a short brief. Later messages blur that agreement. Freelancers may absorb extra work, while clients may not realize that a request adds effort. We wanted a shared record that makes the change understandable and gives both sides a clear choice.

## What it does

ChangeOrder compares a project brief with client requests. It distinguishes included work, proposed additions, and requests that need clarification. Findings point to source text so the freelancer can review the reasoning. The freelancer sets the estimate and price, then shares a client review link. After agreement, PayPal handles a separate invoice for the additional work. The project records the approval and payment history.

## Why PayPal is central

The product connects scope agreement to collection of the agreed payment. PayPal Invoicing creates a specific, itemized payment request for the accepted change. Invoice status reconciliation separates client approval from confirmed payment. The payment record belongs to the change order, making the relationship between requested work and money visible.

## How AI contributes

The language model interprets unstructured project briefs and client messages. It explains which requests extend the original agreement and points to the supporting text. Application validation checks source quotations. Human review controls the proposal, and application code calculates monetary totals.

## Technical implementation

The application uses React and TypeScript for the workspace and client review screens. An Express server stores project history in SQLite. GPT-4.1 runs through the configured LLM proxy and returns structured scope findings. Zod validates the response, and application code checks quoted evidence against the original sources. Prices use integer cents and reviewed hours and rates.

Shared proposals preserve their terms. Client acceptance and invoice payment are separate states. PayPal Invoicing creates a new invoice for the accepted addition, and invoice reconciliation reads the provider's actual status. The server keeps credentials out of browser code. The repository's README describes live configuration and the explicitly labeled sample walkthrough.

## Verified prototype result

The complete flow ran on November 10, 2026: live GPT-4.1 analysis, source-checked findings, a $120 draft, client review and acceptance, a real PayPal sandbox invoice, sandbox card payment, and an authenticated PayPal API refresh confirming `PAID` with $120 received. The invoice was `INV2-JDLS-UTKF-VGMS-DUD8`. All project data and money in this scenario are test data.

The local demonstration confirmed payment by refreshing the PayPal invoice API. It did not test live webhook delivery to localhost. Automated tests cover webhook signature rejection and duplicate-event handling with a test gateway.

A separate live AI run matched the expected classifications in eight synthetic scenarios (ten individual requests), including included revisions, ambiguity, free bug repair, mixed requests, and one message containing an instruction-injection attempt. All quoted evidence passed exact-source checks. This small run is documented in [AI_EVALUATION.md](AI_EVALUATION.md) and does not establish a production accuracy rate or general security guarantee.

## What makes it different

The main interaction is a shared decision about changing work. An invoice follows that decision. Source-linked explanations help a client understand the request, and included work remains visible so the product does not encourage charging for every message.

## Demonstration scenario

All scenario details are fictional. A freelancer agrees to a $300 landing page. A copy correction remains included. A mobile checkout addition becomes a $120 proposal, based on two hours at $60 per hour. The client reviews the evidence and accepts the proposal. The application creates a separate PayPal sandbox invoice and tracks its real status.

## Impact hypothesis

We expect clearer scope decisions to reduce uncomfortable billing conversations and help freelancers collect payment for agreed additional work. These are hypotheses for user testing, not measured outcomes. Initial validation should measure time to prepare a change proposal, client understanding, acceptance or clarification rate, and confirmed payment completion.

## Business model hypothesis

A subscription for freelancers and small agencies could cover project history and collaboration. Pricing and demand remain unvalidated. Payment processing remains with PayPal, and the prototype uses its sandbox environment.

## Challenges and lessons

Language models can produce plausible quotations, so the application validates each quotation against its source before accepting an analysis. A timing question or an included revision should not become a paid addition. Client acceptance also does not mean that money has arrived. The payment flow keeps proposal approval separate from invoice status, including pending and partial payments.

## What's next

Potential extensions include importing messages from tools freelancers already use, richer proposal revisions, and agency collaboration. These are roadmap ideas rather than implemented features.

## Submission fields to complete

- Public repository URL: https://github.com/joinarun/ChangeOrder
- Functional demo: follow the repository README to run locally. The development interface uses http://localhost:5173.
- Demo video: add a publicly visible YouTube link under three minutes.
- Tools used: GPT-4.1 through the configured Webex LLM proxy, PayPal Invoicing REST API and sandbox, React, TypeScript, Vite, Express, Node.js SQLite, and Zod.
- License: MIT, with a root `LICENSE` file.
- Testing instructions: Node.js 24, `npm ci`, copy `.env.example` to `.env`, configure owner access and optional live integrations, then `npm run dev`. The README explains the sample walkthrough, live AI, sandbox buyer accounts, and payment refresh. `npm run check` runs the automated checks, and `npm run evaluate` runs the separate live semantic evaluation.

## Primary references

- Hackathon rules: https://paypalaihackathon.devpost.com/rules
- PayPal Invoicing overview: https://developer.paypal.com/invoicing/about
- PayPal agent tools reference: https://developer.paypal.com/ai-tools/agent-tools/
