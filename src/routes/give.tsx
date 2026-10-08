import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, Church, HandHeart, HeartHandshake, Loader2 } from "lucide-react";
import { GivingShell } from "@/components/GivingShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { givingTypes, saveGift, formatGiftAmount, type Gift, type GivingType } from "@/lib/giving";

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
  const [prayer, setPrayer] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Gift | null>(null);
  const submitting = useRef(false);

  function submit(event: FormEvent<HTMLFormElement>) {
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
    try {
      setSaved(saveGift({ amount: Math.round(numericAmount * 100) / 100, type, name: name.trim(), prayer: prayer.trim() }));
      setAmount(""); setName(""); setPrayer("");
    } catch {
      setError("Your gift could not be saved on this device. Please try again.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <GivingShell>
      <div className="mx-auto max-w-xl">
        <div className="mb-8 flex items-center gap-4">
          <HeartHandshake className="h-9 w-9 shrink-0 text-primary" strokeWidth={1.5} />
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Make a Gift</h1>
        </div>
        {saved ? (
          <div role="status" className="mb-6 flex gap-3 rounded-lg border border-primary/30 bg-check-in-soft p-4">
            <Check className="h-5 w-5 shrink-0 text-primary" />
            <div><p className="font-medium">{formatGiftAmount(saved.amount)} · {saved.type}</p><p className="mt-1 text-sm text-muted-foreground">Saved on this device as Pending. No payment was taken.</p></div>
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
            <Input id="gift-amount" type="number" inputMode="decimal" min="0.01" max="100000000" step="0.01" required placeholder="0.00" value={amount} onChange={(event) => { setAmount(event.target.value); setSaved(null); }} className="h-16 bg-input text-2xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gift-name">Name <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="gift-name" autoComplete="name" maxLength={150} value={name} onChange={(event) => setName(event.target.value)} className="h-12 bg-input" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gift-prayer">Prayer request <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea id="gift-prayer" maxLength={2000} value={prayer} onChange={(event) => setPrayer(event.target.value)} className="min-h-28 resize-y bg-input" />
          </div>
          <p className="border-t border-border pt-5 text-sm leading-relaxed text-muted-foreground">Payment processing is not connected. Gifts and optional details are saved only on this device as pending, not paid.</p>
          {error ? <p role="alert" className="text-sm text-foreground">{error}</p> : null}
          <Button type="submit" disabled={saving} className="h-14 w-full bg-check-in text-primary-foreground hover:bg-check-in/90 text-base font-semibold">
            {saving ? <Loader2 className="animate-spin" /> : <HeartHandshake />}Give Now<ArrowRight />
          </Button>
        </form>
      </div>
    </GivingShell>
  );
}