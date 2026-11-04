# Giving: production activation

The app reads PAYSTACK_SECRET_KEY on the server. There is no separate code switch from test to live: the Paystack key determines the mode. Never commit a payment secret to GitHub, .env or a VITE_ variable.

## Owner setup

1. In the approved church Paystack account, select Live mode and open API keys and webhooks. Confirm this is the church's own account and settlement bank details.
2. In the Lovable project toolbar, open More → Settings → Secrets (on mobile a desktop browser may expose the toolbar more clearly). Replace PAYSTACK_SECRET_KEY using the secure secret form with the live secret from Paystack. Do not put it in project chat. Leave unrelated secrets unchanged.
3. Publish the tested build to the existing church domain.
4. In Paystack's Live webhook settings, set the webhook to the published origin followed by /api/public/paystack/webhook. For the existing church domain this is:
   https://jesuschristhopeofgloryministries.lovable.app/api/public/paystack/webhook
   Confirm the exact published hostname before saving. Do not use an id-preview hostname. The app passes its /give page as the checkout callback automatically.
5. Save the Paystack settings. The secret used by checkout and webhook signature verification must be the same account's live key.

## Owner acceptance check

With the owner's agreement, make a small real gift using the public /give page. This moves real money and may incur fees. Never use a test card in live mode.

Confirm all of the following before announcing giving is live:
- Checkout belongs to the intended church account and charges ZAR.
- One Pending row is created before checkout.
- A completed charge is recorded in the church Paystack dashboard with the same reference and amount.
- The app records that gift as Paid after server verification, including when the donor does not return from checkout.
- A duplicate webhook does not create another gift.
- The donor sees only their own device history; a signed-in approved owner/staff account can see church-wide history. Public signup does not grant staff access.
- An incomplete checkout is not reported as Paid.

No live payment was made during the code checks. Existing owner/staff approval is required for finance history; no account roles were changed.

## Validation performed on 4 November 2026

- TypeScript: npx tsc --noEmit passed.
- Production build: npm run build passed.
- Giving, family and new payment-confirmation tests: 70 passed.
- New regression checks cover unknown/null confirmation results, rejected signatures, database-error retries, integer minor-unit validation and duplicate confirmations.
- Authenticated finance browser testing and real payment settlement remain owner acceptance checks.

References:
- https://docs.lovable.dev/features/secrets
- https://paystack.com/docs/payments/webhooks/
- https://support.paystack.com/en/articles/2123458
