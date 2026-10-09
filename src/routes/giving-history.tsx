import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { GivingShell } from "@/components/GivingShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { givingTypes, useGifts, formatGiftAmount, giftDay } from "@/lib/giving";

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
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const invalidRange = Boolean(from && to && from > to);
  const filtered = gifts.filter((gift) =>
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
    {error ? <p role="alert" className="mb-4 text-sm">{error}</p> : null}
    <div className="overflow-x-auto border-y border-border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Giving entries saved on this device</caption>
        <thead className="bg-secondary/50 text-muted-foreground"><tr>{["Date", "Amount", "Type", "Status"].map((heading) => <th key={heading} scope="col" className="px-3 py-4 font-medium sm:px-4">{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-border">
          {ready && !error && !invalidRange ? filtered.map((gift) => <tr key={gift.id} className="hover:bg-card">
            <td className="px-3 py-5 sm:px-4"><time dateTime={gift.date}>{new Date(gift.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</time></td>
            <td className="px-3 py-5 font-medium tabular-nums sm:px-4">{formatGiftAmount(gift.amount)}</td>
            <td className="px-3 py-5 sm:px-4">{gift.type}</td>
            <td className="px-3 py-5 sm:px-4"><span className="inline-flex items-center gap-2 text-primary"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{gift.status}</span></td>
          </tr>) : null}
          {(!ready || error || invalidRange || !filtered.length) ? <tr><td colSpan={4} className="px-4 py-16 text-center text-muted-foreground">{!ready ? "Loading giving history…" : error ? "History unavailable" : invalidRange ? "Choose a valid date range" : gifts.length ? "No gifts match these filters" : "No giving entries yet"}</td></tr> : null}
        </tbody>
      </table>
    </div>
    <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Device-only entries · Only gifts marked Paid were confirmed by Paystack.</p>
  </GivingShell>;
}