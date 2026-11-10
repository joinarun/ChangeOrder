# ChangeOrder

**Agree on the extra work. Get paid for it.**

ChangeOrder compares a project brief with client messages, distinguishes included revisions from additional work, and turns a reviewed change into a client-approved PayPal sandbox invoice.

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/).

![Live scope review showing an included revision and a separate $120 addition](docs/screenshots/scope-review.jpg)

## The demo story

Alex agrees to build a $300 landing page for Jamie. Two copy revisions are included, while checkout and payment processing are excluded. Jamie asks for a headline revision, a new mobile checkout, and confirmation of the launch date. ChangeOrder keeps the headline revision in scope, asks for clarification on timing, and drafts only the additional checkout work as a $120 proposal. Alex reviews it, Jamie accepts the exact terms, and PayPal handles the separate invoice.

All people, briefs, messages, and prices in this walkthrough are synthetic.

## Run locally

Use **Node.js 24** and npm. Node.js 22.13 or newer is supported, with the built-in SQLite module.

```sh
npm ci
cp .env.example .env
```

Set `OWNER_ACCESS_CODE` and a random `SESSION_SECRET` in `.env`, then start the app:

```sh
npm run dev
```

Open [localhost:5173](http://localhost:5173). The API runs on port 3001. Enter the owner access code from your local `.env` file. Client review links have a separate, unguessable token and do not require owner access.

### Live AI analysis

Configure these values on the server:

```dotenv
LLM_PROXY_BASE_URL=https://your-openai-compatible-endpoint/openai/v1
LLM_PROXY_ACCESS_TOKEN=your-token
LLM_MODEL=gpt-4.1
```

The configured Webex LLM proxy uses the `/openai/v1/chat/completions` endpoint, a bearer token, `x-cisco-app`, and a unique tracking ID. Access may require the appropriate corporate network. You can point the same application at another OpenAI-compatible chat-completions endpoint using your own credentials.

Without AI credentials, use the explicitly labeled **sample walkthrough**. It contains prewritten findings for the supplied story. Live inference failures remain visible and never silently become sample results.

Use synthetic material with an integration/testing proxy. The application removes configured participant names and email addresses from its model input, but this is not a complete anonymization system.

For your own synthetic project, choose **New project**, enter the brief and client details, then **Add request** and **Review the scope** using Live AI. Expand a finding to edit its estimated hours. The summary sets the hourly rate, and **Edit proposal** lets you review individual draft lines before sharing.

Clients can choose **I'd like to discuss this first**, explain the requested revision, and submit **Request a revision**. A declined proposal cannot create an invoice. Refresh is manual: the owner uses **Check for client approval** and **Check payment status**; the client uses **Refresh status**.

### PayPal sandbox

1. Sign in at the [PayPal Developer dashboard](https://developer.paypal.com/dashboard/).
2. Open the credentials of a **sandbox** REST app with Invoicing enabled.
3. Add its `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` to your local `.env`.
4. Optionally set `PAYPAL_MERCHANT_EMAIL` to the app's business sandbox email and `PAYPAL_SANDBOX_BUYER_EMAIL` to a personal sandbox email for the seeded story.
5. Complete the client review before creating an invoice. Open the resulting PayPal payment page and use a separate personal sandbox account.
6. Refresh the invoice status to reconcile against PayPal's authenticated API. Acceptance, invoice creation, and payment are separate states.

The gateway is restricted to `api-m.sandbox.paypal.com`. This application does not move real money. Do not use a real client's email in the seeded walkthrough.

For a stable HTTPS deployment, register `/api/webhooks/paypal` in the sandbox app and configure `PAYPAL_WEBHOOK_ID`. Incoming events must pass PayPal signature verification. Localhost does not receive remote webhooks, so authenticated invoice refresh is the local confirmation path.

## Why the financial flow is trustworthy

- Every AI quotation must occur exactly in the cited source. Unsupported evidence cannot become a proposal.
- Only findings classified as additional work can be priced. Included work and clarification cannot be charged.
- Human-reviewed hours and rates determine integer-cent totals.
- A source fingerprint prevents proposals from using an outdated analysis.
- Shared terms are immutable. A client accepts a specific proposal before an invoice can be created.
- Stable invoice identifiers and serialized operations protect retries from duplicate invoices.
- Payment reconciliation checks the actual invoice, currency, amount, and settled state. A browser success message does not mark work as paid.
- Owner access, public review access, and verified payment events have distinct boundaries.

## Checks

```sh
npm run check
```

The automated suite uses isolated databases and gateway doubles. It checks the financial and access-control rules without spending money or calling external models. Live integration evidence belongs in [VERIFICATION.md](docs/VERIFICATION.md).

For a separate semantic check against the configured live LLM, run:

```sh
npm run evaluate
```

This sends only the script's synthetic test scenarios to the configured proxy and records actual results in [AI_EVALUATION.md](docs/AI_EVALUATION.md). It requires live model credentials and network access. It does not run in CI.

## Production build

```sh
npm run build
APP_BASE_URL=http://localhost:3001 npm start
```

The production server serves the built React application and API on port 3001. Set `APP_BASE_URL` to the actual origin so review links point to the right host. Keep SQLite storage persistent and run one application instance for this prototype.

A Dockerfile is included:

```sh
docker build -t changeorder .
docker run --env-file .env -e APP_BASE_URL=http://localhost:3001 -p 3001:3001 -v changeorder-data:/app/data changeorder
```

Keep credentials in environment variables or the host's secret manager. Change the local owner code before hosting. The prototype uses shared owner access rather than a multi-tenant identity system.

## Demo and submission materials

- [Three-minute demo narration](docs/DEMO_SCRIPT.md)
- [Devpost submission draft](docs/DEVPOST.md)
- [Integration verification](docs/VERIFICATION.md)

## Stack

React, TypeScript, Vite, Express, SQLite, an OpenAI-compatible LLM proxy, and PayPal Invoicing REST APIs. The frontend contains no provider credentials. [MIT license](LICENSE).
