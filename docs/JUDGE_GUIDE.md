# A short path through ChangeOrder

## Explore the decisions without credentials

Open [the public sample](https://joinarun.github.io/ChangeOrder/). It starts with fictional Orbit Studio data and uses prewritten findings stored only in your browser. It makes no model or payment calls.

1. Read the brief: the $300 fee includes two copy revisions and excludes mobile checkout. Choose **Review supplied requests**.
2. Notice the three outcomes: checkout is additional work, the headline revision is included, and the launch date needs clarification.
3. Open **Evidence ledger**. Filter **Included**: its selection is disabled and its addition is $0. Clear the filter and inspect the exact agreement and message quotes.
4. Edit checkout's hours from 2 to 3.25. The reviewed addition becomes $195. Switch to **Request cards** and see the same estimate, then change it back to 2 for a $120 proposal.
5. Draft the change order and create a client review link. Open it in a second tab of the **same browser**. Accept, or request a revision with a note.
6. Return to the owner tab and check client approval. The public sample stops here: invoice creation is disabled and no paid state is simulated. Use **Reset sample** to start again.

Sample links use browser-local storage and do not share data between devices or people. The full application uses server-persisted bearer links instead.

## See and reproduce the live integrations

[The 2:41 video](https://www.youtube.com/watch?v=Ot-nicfez7c) records live GPT-4.1 analysis, a freelancer correcting an eight-hour estimate to two hours, client acceptance, a real PayPal sandbox invoice, test-card checkout, and authenticated confirmation of $120 received. It also shows the evidence ledger in a clearly labeled public sample using prewritten findings. All project data and funds are synthetic. The video uses stock Gemini Achird conversational synthetic narration and privacy-edited app footage.

To reproduce those integrations, follow [the full local setup](../README.md#run-locally) with your own authorized OpenAI-compatible model gateway and PayPal sandbox credentials. No shared provider secrets are distributed.

## Assess the implementation

- [Verification](VERIFICATION.md): actual integration evidence and limits.
- [AI evaluation](AI_EVALUATION.md): the small synthetic live-model run and its limitations.
- [Impact and differentiation](IMPACT.md): primary problem evidence, existing workflows, and explicitly illustrative economics.
- `npm run check`: typecheck, focused automated invariants, and production build. `npm run build:demo`: isolated public-sample build.

Financial boundaries are enforced on the server: additional-work-only lines, source fingerprints, immutable shared terms, client approval before invoicing, stable invoice identity, and authenticated amount/currency/payment reconciliation. Exact quotations establish source fidelity; human review remains necessary to assess interpretation and price.
