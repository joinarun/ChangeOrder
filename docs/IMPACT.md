# Who ChangeOrder is for, and what we can substantiate

ChangeOrder targets independent web designers and small agencies delivering fixed-price projects with explicit revision allowances. Its job begins when a client sends a new request: identify the relevant agreement, make the proposed change understandable, agree the additional price, and keep the resulting payment attached to that change.

## Evidence for the problem

The Scottish Trades Union Congress's _Freelance and Forgotten_ report surveyed 805 creative-industry workers between March 23 and April 22, 2025. It reports that 59% experienced unclear or unreasonable expectations in freelance work and 69% experienced late-payment issues. The report specifically describes tasks being added without corresponding fee or timeline changes. These are findings from a Scottish creative-industry survey, not estimates for all freelancers or evidence that ChangeOrder solves the problem. [STUC report, summary and pages 11–12](https://www.stuc.org.uk/resources/freelance-and-forgotten-a-report-on-worker-exploitation-in-scotlands-creative-industries.pdf).

The Freelancers Union's own contract creator separates included revisions from additional revisions and calls for both parties' prior written approval of material service and fee changes. That is a useful workflow reference for the product's scope-review and approval steps. The prototype's bearer review link records a decision; it does not authenticate identity or establish the legal effect of a signature. [Freelancers Union contract creator, Revisions/Changes](https://freelancersunion.org/contract/).

## The specific product contribution

ChangeOrder connects five records that would otherwise need to be assembled during a billing conversation:

1. The original brief and the client's exact request.
2. A reviewed classification: included work, additional work, or clarification.
3. The freelancer's chosen deliverable, hours, and price.
4. Client acceptance of the fixed proposal terms.
5. A separate PayPal invoice and its authenticated payment state.

The included $0 revision is a deliberate part of the experience. A useful system should preserve the client's existing entitlement as clearly as it identifies work the freelancer may offer for an additional price. Exact quotation validation checks source fidelity; it does not prove the model's interpretation is correct. Both people still review the proposed change.

## How this relates to existing products

This is a focused implementation within an established category. The comparison below describes the reviewed official pages, not an exhaustive feature audit or a claim that another product cannot support a similar process.

| Product or workflow                    | What its official material describes                                                                                                                                                                               | ChangeOrder's demonstrated focus                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Bonsai                                 | Connected scopes, proposals, contracts, project delivery, and guidance for handling scope changes. [Official scope-creep guide](https://www.hellobonsai.com/blog/how-to-avoid-scope-creep)                         | Compare incoming messages with the original agreement and show exact cited evidence for included, additional, and uncertain work.            |
| HoneyBook                              | Invoice creation and payment pages, with AI assistance for services, quantities, and prices. [Official invoice help](https://help.honeybook.com/en/articles/5189729-add-customize-and-share-invoices-in-honeybook) | Keep source interpretation, reviewed pricing, immutable client acceptance, and the separate PayPal payment record in one change-order trail. |
| A contract template and manual invoice | Define revision and change-approval terms, then prepare the change and invoice separately. [Freelancers Union contract creator](https://freelancersunion.org/contract/)                                            | Turn that review-and-approval process into an interactive workflow with a provider-confirmed payment state.                                  |

## Illustrative project economics

This is arithmetic for the fictional demo, not measured customer revenue, profit, or time saved. Assume the original $300 project takes five hours, the requested addition takes two hours, and the freelancer's intended gross rate is $60 per hour.

| Outcome                                         | Gross fee | Total work | Gross fee per hour |
| ----------------------------------------------- | --------: | ---------: | -----------------: |
| Original agreed work                            |      $300 |    5 hours |             $60.00 |
| Addition performed with no new agreement or fee |      $300 |    7 hours |             $42.86 |
| Addition agreed and paid at 2 × $60             |      $420 |    7 hours |             $60.00 |

The $120 additional fee preserves the assumed gross hourly rate in this illustration. Processing fees, taxes, overhead, and the cost of delivering the work are excluded. ChangeOrder does not guarantee that a client will accept an addition, that the estimate is right, or that an invoice will be paid. Its demonstrated result is a $120 payment using sandbox funds and fictional people.

## Validation still needed

There is no claim of customers, adoption, willingness to pay, collection improvement, or production accuracy. A useful pilot would compare the same freelancer's manual and assisted proposal-preparation time, ask clients to explain what is included and what costs extra, and track requested revisions, accepted terms, and confirmed payment completion. Also track incorrect additional-work classifications on requests that should stay included. Publish the sample size and failures alongside any results.

The current small synthetic model evaluation is documented separately in [AI_EVALUATION.md](AI_EVALUATION.md). Live integration verification is in [VERIFICATION.md](VERIFICATION.md).
