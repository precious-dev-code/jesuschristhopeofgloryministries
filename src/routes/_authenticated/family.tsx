import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Users, Plus, Pencil, Trash2, ShieldCheck, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { getFamilyAccess, getFamilyData, saveFamilyLink, removeFamilyLink } from "@/lib/family.functions";
import { familyRoles, reciprocals, relativeView, type FamilyLink, type FamilyRole } from "@/lib/family";
import { FamilyShell } from "@/components/FamilyShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/family")({
  validateSearch: (search: Record<string, unknown>) => ({ member: typeof search.member === "string" ? search.member : undefined }),
  head: () => ({ meta: [
    { title: "Member Families — GloryGate Connect" }, { name: "description", content: "Private staff management of church member family relationships." },
    { property: "og:title", content: "Member Families — GloryGate Connect" }, { property: "og:description", content: "Private family records at Jesus Christ Hope of Glory Ministries." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex,nofollow" },
  ] }),
  component: FamilyPage,
});
function FamilyPage() {
  const initial = Route.useSearch();
  const qc = useQueryClient();
  const accessFn = useServerFn(getFamilyAccess);
  const fetchFn = useServerFn(getFamilyData);
  const saveFn = useServerFn(saveFamilyLink);
  const removeFn = useServerFn(removeFamilyLink);
  const access = useQuery({ queryKey: ["family-access"], queryFn: () => accessFn() });
  const family = useQuery({ queryKey: ["family-data"], queryFn: () => fetchFn(), enabled: access.data?.allowed === true });
  const [selectedId, setSelectedId] = useState(initial.member ?? "");
  const [search, setSearch] = useState("");
  const [pickerSearch, setPickerSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<FamilyLink | null>(null);
  const [relativeId, setRelativeId] = useState("");
  const [role, setRole] = useState<FamilyRole>("Mother");
  const [reciprocalRole, setReciprocalRole] = useState<FamilyRole | "">("Child");
  const [remove, setRemove] = useState<FamilyLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const members = family.data?.members ?? [];
  const selected = members.find(m => m.id === selectedId);
  const links = (family.data?.links ?? []).filter(l => l.member_a === selectedId || l.member_b === selectedId) as FamilyLink[];
  const relative = members.find(m => m.id === relativeId);
  function begin(link?: FamilyLink) {
    const view = link ? relativeView(link, selectedId) : null;
    setEdit(link ?? null); setRelativeId(view?.relativeId ?? ""); setRole(view?.role ?? "Mother"); setReciprocalRole(view?.reciprocalRole ?? "Child"); setPickerSearch(""); setError(""); setOpen(true);
  }
  async function save() {
    if (!selected || !relative || !reciprocalRole || busy) return;
    setBusy(true); setError("");
    try {
      await saveFn({ data: { id: edit?.id, version: edit?.version, personId: selected.id, relativeId, role, reciprocalRole } });
      await qc.invalidateQueries({ queryKey: ["family-data"] }); setOpen(false); toast.success("Family relationship saved");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save. Please try again."); }
    finally { setBusy(false); }
  }
  async function confirmRemove() {
    if (!remove || busy) return;
    setBusy(true);
    try { await removeFn({ data: { id: remove.id, version: remove.version } }); await qc.invalidateQueries({ queryKey: ["family-data"] }); setRemove(null); toast.success("Relationship removed"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not remove relationship."); }
    finally { setBusy(false); }
  }
  return <FamilyShell signedIn>
    <div className="mb-8 flex items-center gap-3"><Users className="h-8 w-8 text-primary" /><h1 className="font-display text-3xl font-semibold">Member families</h1></div>
    {access.isPending ? <Loader2 aria-label="Checking staff access" className="animate-spin text-primary" /> : access.isError ? <p role="alert">Could not check access. <Button variant="outline" onClick={() => access.refetch()}>Retry</Button></p> : !access.data.allowed ? <section className="max-w-lg border-t border-border py-8"><ShieldCheck className="mb-4 h-8 w-8 text-primary" /><h2 className="font-display text-2xl">Approval required</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">You are signed in, but your account has not been approved for Family records. Ask the church owner to grant staff access.</p></section> : family.isPending ? <Loader2 aria-label="Loading families" className="animate-spin text-primary" /> : family.isError ? <p role="alert">Could not load families. <Button variant="outline" onClick={() => family.refetch()}>Retry</Button></p> : <div className="grid gap-8 md:grid-cols-[260px_1fr]">
      <aside><Label htmlFor="member-search">Find a member</Label><div className="relative mt-2"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="member-search" type="search" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" placeholder="Search existing members" /></div>
        <div className="mt-4 max-h-72 space-y-1 overflow-y-auto md:max-h-[65vh]">{members.filter(m => m.member_name.toLowerCase().includes(search.toLowerCase())).map(m => <Button key={m.id} variant={selectedId === m.id ? "secondary" : "ghost"} className="h-auto min-h-11 w-full justify-start whitespace-normal text-left" onClick={() => setSelectedId(m.id)}>{m.member_name}</Button>)}</div>
        {members.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No members registered.</p>}
      </aside>
      <section className="min-w-0 border-t border-border pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
        {!selected ? <p className="text-muted-foreground">Select a member to view their family.</p> : <>
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="break-words font-display text-2xl font-semibold">{selected.member_name}</h2>{selected.phone && <p className="mt-2 text-sm text-muted-foreground">{selected.phone}</p>}</div><Button onClick={() => begin()}><Plus />Add relative</Button></div>
          <h3 className="mb-4 mt-8 text-xs font-semibold uppercase text-primary">Family relationships · {links.length}</h3>
          {links.length === 0 ? <p className="border-t border-border py-6 text-sm text-muted-foreground">No family relationships recorded.</p> : <ul className="divide-y divide-border">{links.map(link => {
            const view = relativeView(link, selected.id);
            const person = members.find(m => m.id === view?.relativeId);
            if (!view || !person) return null;
            return <li key={link.id} className="py-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm leading-6">{selected.member_name} is <strong className="text-primary">{view.role}</strong> of {person.member_name}</p><p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{person.member_name} is {view.reciprocalRole} of {selected.member_name}</p><Button variant="link" className="mt-2 h-auto p-0" onClick={() => setSelectedId(person.id)}>View {person.member_name}<ArrowRight className="h-3 w-3" /></Button></div><div className="flex shrink-0"><Button variant="ghost" size="icon" title="Edit relationship" aria-label={`Edit relationship with ${person.member_name}`} onClick={() => begin(link)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Remove relationship" aria-label={`Remove relationship with ${person.member_name}`} onClick={() => setRemove(link)}><Trash2 className="h-4 w-4" /></Button></div></div></li>;
          })}</ul>}
        </>}
      </section>
    </div>}
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" aria-describedby={undefined}><DialogHeader><DialogTitle>{edit ? "Edit relationship" : "Add relative"}</DialogTitle></DialogHeader>
      <Label htmlFor="relative-search">Existing member</Label><Input id="relative-search" type="search" value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Search by member name" />
      <div className="max-h-40 space-y-1 overflow-y-auto" role="group" aria-label="Existing member picker">{members.filter(m => m.id !== selectedId && m.member_name.toLowerCase().includes(pickerSearch.toLowerCase())).map(m => <Button key={m.id} variant={relativeId === m.id ? "secondary" : "ghost"} aria-pressed={relativeId === m.id} className="h-auto min-h-10 w-full justify-start whitespace-normal text-left" onClick={() => setRelativeId(m.id)}>{m.member_name}</Button>)}</div>
      <Label>{selected?.member_name} is</Label><Select value={role} onValueChange={(value: FamilyRole) => { setRole(value); const options = reciprocals[value]; setReciprocalRole(options.length === 1 ? options[0] : ""); }}><SelectTrigger aria-label="Relationship role"><SelectValue /></SelectTrigger><SelectContent>{familyRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
      <p className="text-sm">of <strong>{relative?.member_name ?? "…"}</strong></p>
      <Label>{relative?.member_name ?? "Relative"} is</Label><Select value={reciprocalRole} onValueChange={(value: FamilyRole) => setReciprocalRole(value)}><SelectTrigger aria-label="Reciprocal role"><SelectValue placeholder="Choose reciprocal role" /></SelectTrigger><SelectContent>{reciprocals[role].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
      <p className="text-sm">of <strong>{selected?.member_name}</strong></p>
      {error && <p role="alert" className="text-sm text-foreground">{error}</p>}
      <div className="mt-2 flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy || !relativeId || !reciprocalRole} onClick={save}>{busy && <Loader2 className="animate-spin" />}Save relationship</Button></div>
    </DialogContent></Dialog>
    <AlertDialog open={Boolean(remove)} onOpenChange={value => { if (!value && !busy) setRemove(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remove this family relationship?</AlertDialogTitle><AlertDialogDescription>Only the link is removed. Both members and their attendance histories stay unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e => { e.preventDefault(); void confirmRemove(); }}>Remove relationship</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </FamilyShell>;
}