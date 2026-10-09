import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, Church, HandHeart, HeartHandshake, Loader2 } from "lucide-react";
import { GivingShell } from "@/components/GivingShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { givingTypes, saveGift, updateGiftStatus, type GivingType } from "@/lib/giving";
import { initializePayment, verifyPayment } from "@/lib/paystack.functions";

export const Route = createFileRoute("/give")({
  head: () => ({ meta: [
    { title: "Make a Gift — GloryGate Connect" },
    { name: "description", content: "Prepare a tithe, offering or special project gift for Jesus Christ Hope of Glory Ministries." },
    { property: "og:title", content: "Make a Gift — GloryGate Connect" },
    { property: "og:description", content: "Giving at Jesus Christ Hope of Glory Ministries." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: GivePage,
});

const typeIcons = { Tithe: Church, Offering: HandHeart, "Special Project": HeartHandshake };

function GivePage() {
  const [type, setType] = useState<GivingType>("Tithe");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [prayer, setPrayer] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const submitting = useRef(false);
  const startPayment = useServerFn(initializePayment);
  const confirmPayment = useServerFn(verifyPayment);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") ?? params.get("trxref");
    if (!reference) return;
    window.history.replaceState(null, "", "/give");
    confirmPayment({ data: { reference } })
      .then(({ status }) => {
        try { updateGiftStatus(reference, status); } catch { /* local record unavailable */ }
        setOutcome(status === "Paid"
          ? { ok: true, text: "Thank you! Your gift was received and is marked Paid in Giving History." }
          : status === "Failed"
            ? { ok: false, text: "The payment was not completed. No money was taken." }
            : { ok: false, text: "Your payment is still processing. Check Giving History shortly." });
      })
      .catch(() => setOutcome({ ok: false, text: "We could not confirm your payment yet. Please check Giving History shortly." }));
  }, [confirmPayment]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 100000000) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError("");
    setOutcome(null);
    try {
      const rounded = Math.round(numericAmount * 100) / 100;
      const gift = saveGift({ amount: rounded, type, name: name.trim(), prayer: prayer.trim() });
      try {
        const { authorizationUrl } = await startPayment({ data: { amount: rounded, email: email.trim(), type, name: name.trim(), reference: gift.id, callbackUrl: `${window.location.origin}/give` } });
        window.location.href = authorizationUrl;
        return;
      } catch (cause) {
        updateGiftStatus(gift.id, "Failed");
        setError(cause instanceof Error ? cause.message : "Payment could not be started. Please try again.");
      }
    } catch {
      setError("Your gift could not be saved on this device. Please try again.");
    }
    submitting.current = false;
    setSaving(false);
  }

  return (
    <GivingShell>
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center gap-4">
          <HeartHandshake className="h-9 w-9 shrink-0 text-primary" strokeWidth={1.5} />
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Make a Gift</h1>
        </div>
        {outcome ? (
          <div role="status" className="mb-6 flex gap-3 rounded-lg border border-primary/30 bg-check-in-soft p-4">
            <Check className="h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm font-medium">{outcome.text}</p>
          </div>
        ) : null}
        <form onSubmit={submit} className="space-y-7">
          <fieldset>
            <legend className="mb-3 text-sm font-medium">Gift type</legend>
            <div className="grid grid-cols-3 gap-2 sm:gap-3" role="radiogroup" aria-label="Gift type">
              {givingTypes.map((option) => {
                const Icon = typeIcons[option];
                return <Button key={option} type="button" role="radio" aria-checked={type === option} variant="outline" onClick={() => setType(option)} className={`h-24 min-w-0 flex-col gap-2 whitespace-normal px-2 text-center text-xs sm:text-sm ${type === option ? "border-primary bg-secondary text-primary hover:bg-secondary hover:text-primary" : "border-border bg-card text-foreground hover:bg-secondary hover:text-foreground"}`}>
                  <Icon className="size-6" strokeWidth={1.5} /><span>{option}</span>
                </Button>;
              })}
            </div>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="gift-amount">Amount (ZAR)</Label>
            <Input id="gift-amount" type="number" inputMode="decimal" min="0.01" max="100000000" step="0.01" required placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} className="h-16 bg-input text-2xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gift-email">Email <span className="font-normal text-muted-foreground">(for your payment receipt)</span></Label>
            <Input id="gift-email" type="email" autoComplete="email" required maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 bg-input" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gift-name">Name <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="gift-name" autoComplete="name" maxLength={150} value={name} onChange={(event) => setName(event.target.value)} className="h-12 bg-input" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gift-prayer">Prayer request <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea id="gift-prayer" maxLength={2000} value={prayer} onChange={(event) => setPrayer(event.target.value)} className="min-h-28 resize-y bg-input" />
          </div>
          <p className="border-t border-border pt-5 text-sm leading-relaxed text-muted-foreground">You will be taken to Paystack’s secure page to complete your gift. Your record is kept on this device and marked Paid only after Paystack confirms it.</p>
          {error ? <p role="alert" className="text-sm text-foreground">{error}</p> : null}
          <Button type="submit" disabled={saving} className="h-14 w-full bg-check-in text-primary-foreground hover:bg-check-in/90 text-base font-semibold">
            {saving ? <Loader2 className="animate-spin" /> : <HeartHandshake />}Give Now<ArrowRight />
          </Button>
        </form>
      </div>
    </GivingShell>
  );
}