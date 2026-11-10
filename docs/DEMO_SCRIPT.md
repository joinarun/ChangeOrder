# ChangeOrder demo and judge walkthrough

The [demo](https://www.youtube.com/watch?v=Ot-nicfez7c) runs **2:41** and records the working application: live AI analysis, human review of the estimate, client acceptance, a fresh PayPal sandbox invoice, sandbox checkout, and an authenticated payment-status check. It also shows the current evidence ledger in a clearly labeled **public sample using prewritten findings**. The recording uses stock Gemini Achird conversational synthetic narration, privacy masks, and burned-in captions.

The full live-analysis and PayPal sandbox payment flow was verified on November 10, 2026. The recorded run visibly changes the model's initial **eight-hour** estimate to the freelancer's chosen **two hours**, producing a **$120** proposal. PayPal subsequently reports `PAID` with $120 received after an authenticated API refresh. All funds are sandbox test funds. Live webhook delivery was not tested on localhost.

## Judge access

Open the [interactive browser sample](https://joinarun.github.io/ChangeOrder/) to review the supplied brief and three requests, load prewritten findings, edit hours, create a proposal, and test client acceptance or decline. Data stays in that browser. A sample review link works in another tab using the same storage; it does not share state with another person's browser. The sample makes **no AI or PayPal calls**, stops at approval, and cannot produce an invoice or a paid status.

To run this no-key sample locally:

```sh
npm ci
npm run demo
```

Open http://localhost:5174. No `.env`, access code, or provider credentials are needed. For live analysis and the complete sandbox payment flow, use the [README's full local setup](../README.md#run-locally) with your own credentials.

## Recording chapters

Times are rounded to the nearest second. The native video contains nine chapter markers.

| Start | Chapter | What to look for |
| --- | --- | --- |
| 00:00 | The extra work problem | A small request can create unpaid work on a fixed-price project. |
| 00:16 | The agreement and three requests | A $300 brief includes two copy revisions and excludes checkout. The headline, checkout, and launch date need different decisions. |
| 00:32 | Live AI with source evidence | Live analysis classifies the requests and presents quotations from the brief and message. The server checks the quoted text; the freelancer reviews the interpretation. |
| 00:50 | Evidence ledger — prewritten public sample | Filter findings, inspect sources, and edit hours in the AG Grid Community ledger. Included work cannot be selected for billing; cards and proposal totals stay synchronized. This segment uses prewritten findings. |
| 01:06 | Human review of the price | Back in the live run, the freelancer changes eight suggested hours to two. At $60 per hour, the checkout addition costs $120. Sharing locks that scope and price. |
| 01:24 | Client agreement | The client sees the deliverable, price, and evidence, then accepts. Acceptance records a test approval; it does not charge an account or mark an invoice paid. |
| 01:41 | A separate PayPal sandbox invoice | The app creates a separate $120 sandbox invoice and opens PayPal's actual hosted payment page. The original project fee stays separate. |
| 01:59 | PayPal confirms payment | A sandbox test card completes checkout. **Check payment status** retrieves the invoice through PayPal's authenticated API; the provider-confirmed result marks $120 received. |
| 02:20 | Activity record and close | The activity record connects the request, approval, invoice, and verified payment. Judges can try the browser sample or run the full build locally. |

## Recording and validation

The screen recording is edited for pacing from actual app captures. Account details and private review addresses are masked. Invoice loading frames are replaced with a hold on a later actual loaded invoice screenshot; no UI or payment state is fabricated. Narration plays at its original speed.

The revised export passed complete video/audio decoding and privacy checks on all 244 captured source states and 280 samples from the final encoded video. Its 39 captions follow the authorized narration script. Automatic caption timing was aligned to the audio; it has not been manually checked word by word.

The repository's automated tests separately exercise duplicate invoice actions, forged webhook signals, stale sources, immutable proposals, exact sample applicability, and inconsistent payment states. Run `npm run check` to repeat the local checks; `npm run evaluate` separately requires live model access.

## Presenter walkthrough

The companion presentation follows the same story. Use its speaker notes to rehearse, and export the saved deck as PowerPoint through the presentation viewer when an offline copy is needed.

## Supporting submission materials

- [Official submitted entry](https://devpost.com/software/changeorder)
- [Public source, MIT license, and complete run instructions](https://github.com/joinarun/ChangeOrder)
- [Live integration verification](VERIFICATION.md)
- [Synthetic live-model evaluation and its limits](AI_EVALUATION.md)
- [Problem evidence and illustrative impact economics](IMPACT.md)
