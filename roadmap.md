# Roadmap

# Live Paystack giving
- [x] Inspect existing giving implementation and access patterns.
- [ ] Persistent gifts table with references, cents amounts, timestamps, verified status.
- [ ] Server-side Pending record creation + server-side validation before checkout.
- [ ] Signature-verified, idempotent Paystack webhook (success/failed, amount+currency checks).
- [ ] Return verification kept; never trust browser-provided statuses; fix uncertain-outcome copy.
- [ ] RLS: donors see own device records; owner/staff see church-wide history; no public admin.
- [ ] Tests: success/failed/pending/duplicate webhook, amount mismatch, access controls.
- [ ] Update AGENTS.md/memory that required browser-local giving storage.
- [ ] Report webhook URL, Paystack settings, completed/tested/pending; secrets form for live key.
- [ ] Waiting on user: explicit confirmation before publishing live payments.

# Family relationships
- [ ] Add private staff access and additive canonical relationship storage.
- [ ] Add member family views, searchable picker and edit/remove links.
- [ ] Verify rules, persistence, access denial and mobile preview without changing live people.
- [ ] Owner setup: approve the first staff account explicitly; never auto-promote.

# Giving screens
- [x] Add Give Now form with optional fields and matching colors.
- [x] Add Giving History with date, type and status filters.
- [x] Add both screens to the menu and verify submission/history flow.
# Paystack payments
- [x] Server functions to start and verify Paystack payments (ZAR).
- [x] Give Now redirects to Paystack; History shows Paid/Failed/Pending.
- [ ] Waiting on user: Paystack SECRET test key (sk_test_...) to enable live test payments.
