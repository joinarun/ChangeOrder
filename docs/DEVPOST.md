# ChangeOrder

[Official submitted entry](https://devpost.com/software/changeorder) · [Interactive browser sample](https://joinarun.github.io/ChangeOrder/) · [Published 2:26 demo](https://www.youtube.com/watch?v=3MrY5qSpn4E) · [Public MIT-licensed source](https://github.com/joinarun/ChangeOrder)

## Judge access

The public browser sample lets judges inspect the supplied brief and requests, load explicitly prewritten findings, review evidence, edit the estimate, and test client acceptance or decline. It stores data only in that browser and makes no AI or PayPal calls. Review links work in another tab sharing that browser's storage; approval is the endpoint of this sample, and it creates no invoice or paid state.

For the same no-key experience locally, run `npm ci` and `npm run demo`, then open http://localhost:5174. No `.env`, login, model access, or PayPal account is needed. The complete local build described in the README enables live analysis and actual sandbox invoicing with the judge's own credentials. The public video demonstrates that full integrated flow with fictional project data and sandbox funds.

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

AG Grid Community powers an evidence ledger in scope review. Users can filter and sort findings, inspect source-evidence details, edit estimated hours, and select additional-work rows. These controls share state with the review cards and proposal total. Included work and clarification cannot be selected for a charge.

Shared proposals preserve their terms. Client acceptance and invoice payment are separate states. PayPal Invoicing creates a new invoice for the accepted addition, and invoice reconciliation reads the provider's actual status. The server keeps credentials out of browser code. The repository's README describes live configuration and the explicitly labeled sample walkthrough.

## Verified prototype result

The complete flow ran on November 10, 2026: live GPT-4.1 analysis, source-checked findings, a $120 draft, client review and acceptance, a real PayPal sandbox invoice, sandbox card payment, and an authenticated PayPal API refresh confirming `PAID` with $120 received. The invoice was `INV2-JDLS-UTKF-VGMS-DUD8`. All project data and money in this scenario are test data.

The separately recorded public demo shows a fresh run with invoice `INV2-FNSQ-7F8U-BP9S-425P`. The model initially suggested eight hours; the freelancer changed the estimate to two hours before sharing a $120 proposal. This human review is visible in the recording. The recording demonstrates the core live flow; the current interactive sample and source also contain the evidence ledger.

The local demonstration confirmed payment by refreshing the PayPal invoice API. It did not test live webhook delivery to localhost. Automated tests cover webhook signature rejection and duplicate-event handling with a test gateway.

A separate live AI run matched the expected classifications in eight synthetic scenarios (ten individual requests), including included revisions, ambiguity, free bug repair, mixed requests, and one message containing an instruction-injection attempt. All quoted evidence passed exact-source checks. This small run is documented in [AI_EVALUATION.md](AI_EVALUATION.md) and does not establish a production accuracy rate or general security guarantee.

## What makes it different

The main interaction is a shared decision about changing work. An invoice follows that decision. Source-linked explanations help a client understand the request, and included work remains visible so the product does not encourage charging for every message.

## Demonstration scenario

All scenario details are fictional. A freelancer agrees to a $300 landing page. A copy correction remains included. A mobile checkout addition becomes a $120 proposal, based on two hours at $60 per hour. The client reviews the evidence and accepts the proposal. The application creates a separate PayPal sandbox invoice and tracks its real status.

## Impact hypothesis

We expect clearer scope decisions to reduce uncomfortable billing conversations and help freelancers collect payment for agreed additional work. These are hypotheses for user testing, not measured outcomes. Initial validation should measure time to prepare a change proposal, client understanding, acceptance or clarification rate, and confirmed payment completion. [IMPACT.md](IMPACT.md) documents sourced problem evidence, a bounded comparison with existing workflows, illustrative project economics, and the validation still needed. It makes no claim of customer adoption or measured revenue gains.

## Business model hypothesis

A subscription for freelancers and small agencies could cover project history and collaboration. Pricing and demand remain unvalidated. Payment processing remains with PayPal, and the prototype uses its sandbox environment.

## Challenges and lessons

Language models can produce plausible quotations, so the application validates each quotation against its source before accepting an analysis. A timing question or an included revision should not become a paid addition. Client acceptance also does not mean that money has arrived. The payment flow keeps proposal approval separate from invoice status, including pending and partial payments.

## What's next

Potential extensions include importing messages from tools freelancers already use, richer proposal revisions, and agency collaboration. These are roadmap ideas rather than implemented features.

## Submission and testing links

- Official submitted entry: https://devpost.com/software/changeorder
- Public repository: https://github.com/joinarun/ChangeOrder
- Interactive sample: https://joinarun.github.io/ChangeOrder/ — prewritten findings, browser-local state, approval only, no live provider calls.
- Public demo video: https://www.youtube.com/watch?v=3MrY5qSpn4E — 2:26, showing live AI and actual PayPal sandbox payment.
- Tools used: GPT-4.1 through a server-side OpenAI-compatible gateway, PayPal Invoicing REST API and sandbox, AG Grid Community, React, TypeScript, Vite, Express, Node.js SQLite, and Zod.
- License: MIT, with a root `LICENSE` file.
- No-key testing: Node.js 24, `npm ci`, then `npm run demo`; open http://localhost:5174. The fixed sample needs no `.env` or login.
- Full live testing: copy `.env.example` to `.env`, configure owner access and your own live AI and PayPal sandbox credentials, then `npm run dev`; open http://localhost:5173. Judges should use an authorized compatible endpoint with their own credentials. The README explains sandbox buyer compatibility and payment refresh.
- Repeatable checks: `npm run check` runs typechecking, automated tests, and the production build; `npm run build:demo` builds the standalone browser sample. `npm run evaluate` separately runs the synthetic scenarios against the configured live model.

## Primary references

- Hackathon rules: https://paypalaihackathon.devpost.com/rules
- PayPal Invoicing overview: https://developer.paypal.com/invoicing/about
- PayPal agent tools reference: https://developer.paypal.com/ai-tools/agent-tools/
