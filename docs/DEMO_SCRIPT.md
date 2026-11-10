# ChangeOrder demo script

Target recording length: 2 minutes 45 seconds. Record the working application. Use the presentation as a walkthrough and rehearsal aid, rather than substituting slides for the functional demo.

The full live-analysis and PayPal sandbox payment flow was verified on November 10, 2026. Invoice `INV2-JDLS-UTKF-VGMS-DUD8` reached `PAID` with $120 received after an authenticated PayPal API refresh. Live webhook delivery was not tested on localhost.

## Before recording

- Start the application and check the integration status.
- Use a fresh sample project with a $300 original agreement and a proposed $120 mobile checkout addition.
- Keep the original brief, client messages, and both browser perspectives ready.
- Use sandbox accounts and fictional project data. Keep tokens, credentials, personal browser tabs, and developer secrets out of the recording.
- Use the app's actual integration labels. Sample analysis and live proxy analysis are different modes.
- Show a payment confirmation only after PayPal confirms the invoice status. Approval alone does not mean payment.

## 00:00–00:20: the problem

“A freelancer agrees to a $300 landing page. Then the client asks for mobile checkout. The request sounds small, but it changes the work. The freelancer needs a fair way to explain the change, agree on a price, and get paid.”

Show the project brief and messages. Point out one included copy correction beside the mobile checkout request.

## 00:20–00:55: evidence-backed analysis

“ChangeOrder compares the agreement with the client’s actual requests. Each finding links back to the source text. The copy correction stays included. The checkout addition becomes a proposed change. The freelancer reviews the reasoning before sending anything.”

Run analysis in the application. Open the supporting brief quote and request quote. Show at least one included item to demonstrate that the app does not charge for every request.

## 00:55–01:20: a clear proposal

“The freelancer controls the estimate and the price. Here, two hours at $60 creates a $120 proposal. The amount comes from the reviewed estimate. The client receives the extra deliverable, the reason for the change, and the price in one place.”

Review the proposed items and edit an estimate if needed. Create the client review link.

## 01:20–01:45: client agreement

“The client can review and accept the change or decline it. They see the same evidence as the freelancer. Accepting a proposal records agreement. It does not silently charge their account.”

Open the client view. Show the proposal and accept it. If rejection is easier to demonstrate as a separate project, keep that as an optional backup clip.

## 01:45–02:20: PayPal payment

“After approval, ChangeOrder creates a separate PayPal sandbox invoice for the agreed extra work. The original $300 agreement stays clear. The client uses PayPal’s payment page, and ChangeOrder reconciles the resulting invoice status.”

Create the invoice. Open the actual sandbox payment page. Complete payment with the supported sandbox account or test card, then return to ChangeOrder and use **Check payment status**. Show the provider-confirmed `PAID` status and $120 received. The supplied screenshots document the previously verified run. A fresh recording should show the new run's actual invoice state.

## 02:20–02:35: trust and failure handling

“The audit history connects the request, the approved change, and the PayPal invoice. Included work stays included. The client’s approval and PayPal’s payment confirmation remain separate events.”

Show the actual audit trail and point back to the included $0 headline revision. The repository's automated tests separately exercise duplicate invoice actions, forged webhook signals, stale sources, and inconsistent payment states.

## 02:35–02:45: close

“ChangeOrder gives freelancers a fair way to price changing work, and gives clients a clear choice before they pay. AI explains the change. People approve it. PayPal completes the payment.”

## Optional presenter walkthrough

The companion presentation follows this story across ten slides. Use its speaker notes to rehearse, and export the saved deck as PowerPoint through the presentation viewer when an offline copy is needed.

## Recording acceptance checks

- The video remains under three minutes.
- The app performs the flow shown on screen.
- AI output and sample output carry accurate labels.
- PayPal sandbox invoice and payment states match the narration.
- A viewer can identify the user, problem, and benefit in the opening twenty seconds.
- The final submission links the public licensed source repository and complete run instructions.
