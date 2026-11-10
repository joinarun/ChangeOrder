# Verification record

Verified on November 10, 2026 using synthetic project data and PayPal sandbox funds.

## Live end-to-end result

The complete path ran through the working browser UI:

1. Loaded the Orbit Studio example with a $300 original brief and three client requests.
2. Ran live inference through the configured Webex LLM proxy using GPT-4.1.
3. Received three correctly separated findings: included headline revision ($0), additional mobile checkout (2 hours at $60, $120), and timeline clarification ($0).
4. Verified the returned quotations against the original brief and message strings on the server.
5. Created the $120 proposal and generated its private client-review link.
6. Opened the client view, reviewed the exact scope, and accepted it using the synthetic client identity.
7. Created and issued a real PayPal sandbox invoice for only the approved $120 addition.
8. Opened PayPal's hosted invoice, signed in as the separate sandbox buyer, and completed a test-card payment.
9. PayPal displayed **Payment successful**. ChangeOrder separately fetched the invoice from PayPal's authenticated API and changed the order to **Paid**, with USD 120.00 received.
10. Repeating the invoice action retained the same paid PayPal invoice rather than creating another one.

Sandbox invoice: `INV2-JDLS-UTKF-VGMS-DUD8`. No real money moved, and invoice email notifications were disabled. The application shared the hosted payment page instead.

The first environment check exposed `INR_FOREIGN_CURRENCY_BLOCKED` when both test parties were India accounts. An existing India merchant application and a US personal sandbox buyer completed the cross-border USD flow successfully. No new REST application or developer agreement was required. Use accounts compatible with the invoice currency and region when reproducing the demo.

## Browser checks

- Owner workspace, live analysis, proposal sharing, public review, client approval, PayPal invoice creation, hosted sandbox checkout, and authoritative payment refresh passed.
- The client view rendered at a 390-pixel CSS viewport without horizontal overflow. The desktop view was restored afterward.
- The app distinguishes sample findings from live inference and approval from payment.
- Payment confirmation comes from the PayPal invoice API, not the checkout browser's success page.
- The production build served the app shell, client-review route, and API health endpoint successfully in a separate local smoke run.

## Automated checks

`npm run check` runs TypeScript checking, eight tests with isolated SQLite databases/gateway doubles, and the production Vite build.

The tests exercise access/origin checks, exact evidence and source IDs, included-work billing rejection, cent arithmetic, stale source analysis, immutable accepted scope/recipient/original fee, client decline, duplicate invoice suppression, authoritative payment state, partial/pending/refunded states, invoice identity/currency mismatches, stale-response protection, webhook verification/deduplication, and LLM adapter behavior. Test doubles do not establish live provider behavior; the browser run above supplies that evidence.

## Limits of this verification

- Localhost does not receive PayPal's remote webhook deliveries. The signature-verification and duplicate-event code paths were tested with injected gateways. No live webhook delivery is claimed.
- The demonstration uses a single owner workspace and bearer review links. It does not authenticate a client's identity, provide legal signatures, or provide multi-tenant access isolation.
- This prototype uses a single application process with persistent SQLite storage.
- The corporate LLM endpoint may require network access and refreshed credentials. The public repository contains no access tokens, sandbox passwords, client secrets, or local database.
- Live semantic evaluation results, when run, are recorded separately in [AI_EVALUATION.md](AI_EVALUATION.md).

## Screenshots

The files under [screenshots](screenshots/) capture the actual synthetic demo, including live source analysis, client review, PayPal invoice, PayPal success screen, and the application's independently confirmed payment state.

## Submission improvements on November 10, 2026

The post-submission review added an AG Grid Community Evidence ledger and a separately built browser-only sample. In browser QA, filtering Included kept the additional-work selection while disabling all included rows; editing checkout to 3.25 hours at $60 produced $195 in both ledger and cards; restoring two hours produced a $120 proposal. A second same-browser tab accepted the shared sample terms. The owner refreshed the approval, and PayPal invoicing remained disabled. This sample does not call a model or payment API and never simulates paid invoices.

Two regression fixes were reproduced and checked: changed sources cannot cross the draft-sharing boundary, and prewritten findings reject amended agreements, edited requests, or additional requests. The final automated suite has 14 passing tests, with typecheck and both production builds passing. The configured credential values were scanned against the normal and public browser build files with no matches. The ledger is loaded only when opened; the normal initial JavaScript is about 288KB uncompressed (88KB gzip).

[Actual ledger screenshot](screenshots/evidence-ledger.jpg). Public deployment and CI are verified separately after the source push.
