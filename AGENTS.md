<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Giving records are stored persistently in the public.gifts database table (amounts in cents, unique Paystack reference, verified status). The Pending record is created server-side in src/lib/paystack.functions.ts before checkout; status changes go only through the idempotent confirm_gift/fail_gift database functions, driven by the Paystack webhook (src/routes/api/public/paystack/webhook.ts) and the return-visit verify. Donors read only their own device-token rows; church-wide history is owner/staff only via user_roles, never public signup. PAYSTACK_SECRET_KEY is used only in src/lib/paystack.functions.ts and the Paystack webhook route.
- Share giving-page presentation through a dedicated shell while leaving existing attendance and check-in screens unchanged.
- Family records use one ordered member pair with two explicit compatible roles; unique pair and database constraints prevent reversed duplicates without merging identities.
- Family server functions use authenticated RLS clients and check has_family_access before every operation; roles are managed out-of-band in user_roles, never assigned by signup.
- The authenticated subtree is reserved for Family; keep existing kiosk routes public and never use the admin client for family reads/writes.
- Family updates/removals use a version predicate in a single database statement to detect concurrent edits; member deletion cascades only family links.
- Children remain separate identities; family links currently reference members only because there is no verified child-to-member mapping.
