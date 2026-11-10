# ChangeOrder published demo and judge walkthrough

The [published demo](https://www.youtube.com/watch?v=3MrY5qSpn4E) runs **2:26** and records the working application. It shows live GPT-4.1 analysis, human review of the estimate, client acceptance, a fresh PayPal sandbox invoice, sandbox checkout, and an authenticated payment-status check. The screen recording is edited for pacing and uses standard synthetic English narration and burned-in captions. No payment state was fabricated.

The full live-analysis and PayPal sandbox payment flow was verified on November 10, 2026. Invoice `INV2-JDLS-UTKF-VGMS-DUD8` reached `PAID` with $120 received after an authenticated PayPal API refresh. Live webhook delivery was not tested on localhost.

The published recording is a separate fresh run with invoice `INV2-FNSQ-7F8U-BP9S-425P`. It visibly changes the model's initial **eight-hour** estimate to the freelancer's chosen **two hours**, producing the $120 proposal. The two invoice identifiers document separate test runs.

## Judge access

Open the [interactive browser sample](https://joinarun.github.io/ChangeOrder/) to review the supplied brief and three requests, load prewritten findings, edit hours, create a proposal, and test client acceptance or decline. Data stays in that browser. A sample review link works in another tab using the same storage; it does not share state with another person's browser. The sample makes **no AI or PayPal calls**, stops at approval, and cannot produce an invoice or a paid status.

To run this no-key sample locally:

```sh
npm ci
npm run demo
```

Open http://localhost:5174. No `.env`, access code, or provider credentials are needed. For live analysis and the complete sandbox payment flow, use the [README's full local setup](../README.md#run-the-complete-local-application) with your own credentials.

The current application also includes an **AG Grid Community evidence ledger** for sorting/filtering findings, reviewing source detail, editing hours, and selecting only additional work. Its state stays synchronized with the cards and proposal total. This ledger can be explored in the current sample; the published recording demonstrates the earlier core live workflow and does not show the ledger.

## 00:00–00:16: the problem

The opening presents the $300 project and the new mobile-checkout request. The benefit is a clear decision about the extra work and its price.

## 00:16–00:51: the agreement and evidence-backed analysis

The recording shows two included copy revisions and explicitly excluded checkout, then runs Live AI. Supporting brief and message quotations explain the classification. The included revision remains at $0, while the launch-date question needs clarification.

## 00:51–01:09: a reviewed proposal

The freelancer changes the suggested estimate from eight hours to two. Two hours at $60 creates the $120 proposal. Sharing creates a client review link and locks the scope and price for that version.

## 01:09–01:26: client agreement

The client view presents the additional deliverable, price, and evidence. The recorded client accepts the proposal. The current app also allows a revision request; a declined proposal cannot create an invoice.

## 01:26–02:04: PayPal invoicing and payment

The recording creates the separate invoice and opens PayPal's actual hosted sandbox page. A sandbox test-card payment is completed, then **Check payment status** fetches the invoice through PayPal's authenticated API. Only that provider-confirmed result marks $120 as received.

## 02:04–02:26: audit history and close

The recording closes on the audit trail and the distinction between agreement, invoice, and payment. The repository's automated tests separately exercise duplicate invoice actions, forged webhook signals, stale sources, immutable proposals, exact sample applicability, and inconsistent payment states. Run `npm run check` to repeat the local checks; `npm run evaluate` separately requires live model access.

## Optional presenter walkthrough

The companion presentation follows this story across ten slides. Use its speaker notes to rehearse, and export the saved deck as PowerPoint through the presentation viewer when an offline copy is needed.

## Supporting submission materials

- [Official submitted entry](https://devpost.com/software/changeorder)
- [Public source, MIT license, and complete run instructions](https://github.com/joinarun/ChangeOrder)
- [Live integration verification](VERIFICATION.md)
- [Synthetic live-model evaluation and its limits](AI_EVALUATION.md)
- [Problem evidence and illustrative impact economics](IMPACT.md)
