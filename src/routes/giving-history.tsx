import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { History, RotateCcw, ShieldCheck } from "lucide-react";
import { GivingShell } from "@/components/GivingShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { givingTypes, useGifts, formatGiftAmount, giftDay, type Gift } from "@/lib/giving";
import { getFinanceGifts } from "@/lib/giving.functions";

export const Route = createFileRoute("/giving-history")({
  head: () => ({ meta: [
    { title: "Giving History — GloryGate Connect" },
    { name: "description", content: "Review dated giving entries for Jesus Christ Hope of Glory Ministries, with type and status filters." },
    { property: "og:title", content: "Giving History — GloryGate Connect" },
    { property: "og:description", content: "Dated gift amounts, types and statuses at Jesus Christ Hope of Glory Ministries." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: GivingHistoryPage,
});

function GivingHistoryPage() {
  const { gifts, ready, error } = useGifts();
  const fetchFinance = useServerFn(getFinanceGifts);
  const [finance, setFinance] = useState<{ allowed: boolean; gifts: Gift[] } | null>(null);
  const [financeError, setFinanceError] = useState("");
  const [financeReady, setFinanceReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let generation = 0;
    const refresh = async () => {
      const current = ++generation;
      const { data } = await supabase.auth.getSession();
      if (cancelled || current !== generation) return;
      if (!data.session) {
        setFinance(null);
        setFinanceError("");
        setFinanceReady(true);
        return;
      }
      try {
        const result = await fetchFinance();
        if (!cancelled && current === generation) { setFinance(result); setFinanceError(""); }
      } catch {
        if (!cancelled && current === generation) { setFinance(null); setFinanceError("Church-wide giving history could not be loaded. Please refresh to try again."); }
      } finally {
        if (!cancelled && current === generation) setFinanceReady(true);
      }
    };
    void refresh();
    const onRefresh = () => void refresh();
    const timer = window.setInterval(onRefresh, 30000);
    window.addEventListener("focus", onRefresh);
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      // Clear privileged rows immediately when the session changes.
      generation++;
      setFinance(null);
      setFinanceReady(false);
      window.setTimeout(onRefresh, 0);
    });
    return () => { cancelled = true; generation++; window.clearInterval(timer); window.removeEventListener("focus", onRefresh); listener.subscription.unsubscribe(); };
  }, [fetchFinance]);
  const financeView = finance?.allowed === true;
  const source = financeView ? finance!.gifts : gifts;
  const historyReady = financeReady && (financeView || ready);
  const historyError = financeError || (financeView ? "" : error);
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const invalidRange = Boolean(from && to && from > to);
  const filtered = source.filter((gift) =>
    (type === "all" || gift.type === type) && (status === "all" || gift.status === status) &&
    (!from || giftDay(gift.date) >= from) && (!to || giftDay(gift.date) <= to),
  );
  const hasFilters = type !== "all" || status !== "all" || Boolean(from || to);

  return <GivingShell history>
    <div className="mb-8 flex items-center gap-4">
      <History className="h-9 w-9 shrink-0 text-primary" strokeWidth={1.5} />
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">Giving History</h1>
    </div>
    <div className="mb-8 grid grid-cols-2 items-end gap-4 sm:grid-cols-4">
      <div className="space-y-2"><Label htmlFor="history-type">Type</Label><Select value={type} onValueChange={setType}><SelectTrigger id="history-type" className="h-11 bg-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All types</SelectItem>{givingTypes.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><Label htmlFor="history-status">Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger id="history-status" className="h-11 bg-input"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Paid">Paid</SelectItem><SelectItem value="Failed">Failed</SelectItem></SelectContent></Select></div>
      <div className="min-w-0 space-y-2"><Label htmlFor="history-from">From</Label><Input id="history-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-11 min-w-0 bg-input [color-scheme:dark]" /></div>
      <div className="min-w-0 space-y-2"><Label htmlFor="history-to">To</Label><Input id="history-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-11 min-w-0 bg-input [color-scheme:dark]" /></div>
    </div>
    {hasFilters ? <Button variant="ghost" onClick={() => { setType("all"); setStatus("all"); setFrom(""); setTo(""); }} className="mb-4 text-primary"><RotateCcw />Clear filters</Button> : null}
    {invalidRange ? <p role="alert" className="mb-4 text-sm">The end date must be on or after the start date.</p> : null}
    {financeView ? <p className="mb-4 flex items-center gap-2 text-sm text-primary"><ShieldCheck className="size-4" />Church-wide giving · Approved staff view</p> : null}
    {historyError ? <p role="alert" className="mb-4 text-sm">{historyError}</p> : null}
    <div className="overflow-x-auto border-y border-border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{financeView ? "Church-wide giving entries" : "Giving entries for this device"}</caption>
        <thead className="bg-secondary/50 text-muted-foreground"><tr>{["Date", "Amount", "Type", "Status"].map((heading) => <th key={heading} scope="col" className="px-3 py-4 font-medium sm:px-4">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">
          {historyReady && !historyError && !invalidRange ? filtered.map((gift) => <tr key={gift.id} className="hover:bg-card">
            <td className="px-3 py-5 sm:px-4"><time dateTime={gift.date}>{new Date(gift.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</time></td>
            <td className="px-3 py-5 font-medium tabular-nums sm:px-4">{formatGiftAmount(gift.amount)}</td>
            <td className="px-3 py-5 sm:px-4">{gift.type}</td>
            <td className="px-3 py-5 sm:px-4"><span className="inline-flex items-center gap-2 text-primary"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{gift.status}</span></td>
          </tr>) : null}
          {(!historyReady || historyError || invalidRange || !filtered.length) ? <tr><td colSpan={4} className="px-4 py-16 text-center text-muted-foreground">{!historyReady ? "Loading giving history…" : historyError ? "History unavailable" : invalidRange ? "Choose a valid date range" : source.length ? "No gifts match these filters" : "No giving entries yet"}</td></tr> : null}
        </tbody>
      </table>
    </div>
    <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Entries are stored securely by the church · Only gifts marked Paid were confirmed by Paystack.</p>
  </GivingShell>;
}
