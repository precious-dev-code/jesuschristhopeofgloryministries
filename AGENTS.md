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

- Keep giving records in a separate browser-local store; a gift is Pending until the Paystack server-side verify call confirms it, then Paid/Failed. Paystack calls live only in src/lib/paystack.functions.ts using the PAYSTACK_SECRET_KEY secret.
- Share giving-page presentation through a dedicated shell while leaving existing attendance and check-in screens unchanged.
