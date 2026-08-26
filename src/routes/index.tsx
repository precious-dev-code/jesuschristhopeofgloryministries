import { createFileRoute } from "@tanstack/react-router";
import {
  useQueryClient,
  useQuery,
  queryOptions,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  LogIn,
  LogOut,
  MessageCircle,
  Users,
  Loader2,
  Check,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { recordCheckAction } from "@/lib/checkin.functions";
import { addChild } from "@/lib/children.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Child = Database["public"]["Tables"]["children"]["Row"];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GloryGate Connect — Kids Ministry Check-In" },
      {
        name: "description",
        content:
          "GloryGate Connect: mobile check-in and check-out for Jesus Christ Hope of Glory Ministries kids ministry ushers.",
      },
      { property: "og:title", content: "GloryGate Connect" },
      {
        property: "og:description",
        content:
          "Check in and check out children at Jesus Christ Hope of Glory Ministries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(childrenQueryOptions()),
  component: CheckInComponent,
});

const childrenQueryOptions = () =>
  queryOptions({
    queryKey: ["children"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("*")
        .order("child_name", { ascending: true });
      if (error) throw error;
      return data as Child[];
    },
  });

function CheckInComponent() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { data: children } = useQuery(childrenQueryOptions());

  // Live updates across usher devices via Supabase Realtime.
  useEffect(() => {
    const channel = supabase
      .channel("children-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "children" },
        (payload) => {
          qc.setQueryData<Child[]>(["children"], (prev) =>
            (prev ?? []).map((c) =>
              c.id === (payload.new as Child).id ? (payload.new as Child) : c,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return children ?? [];
    return (children ?? []).filter((c) =>
      c.child_name.toLowerCase().includes(q),
    );
  }, [children, search]);

  const counts = useMemo(() => {
    const list = children ?? [];
    return {
      in: list.filter((c) => c.status === "checked_in").length,
      out: list.filter((c) => c.status === "checked_out").length,
    };
  }, [children]);

  async function handleAction(child: Child, actionType: "Check In" | "Check Out") {
    // No-op if already in that state.
    const already =
      (actionType === "Check In" && child.status === "checked_in") ||
      (actionType === "Check Out" && child.status === "checked_out");
    if (already) return;

    setPendingId(child.id);
    // Optimistic update so the button reflects status immediately.
    const optimisticStatus =
      actionType === "Check In" ? "checked_in" : "checked_out";
    qc.setQueryData<Child[]>(["children"], (prev) =>
      (prev ?? []).map((c) =>
        c.id === child.id
          ? { ...c, status: optimisticStatus, last_action_at: new Date().toISOString() }
          : c,
      ),
    );

    try {
      await recordCheckAction({ data: { childId: child.id, actionType } });
      toast.success(`${child.child_name} ${actionType.toLowerCase()}`, {
        description: "Status synced and Make.com notified.",
      });
    } catch (err) {
      // Revert optimistic update on failure.
      qc.setQueryData<Child[]>(["children"], (prev) =>
        (prev ?? []).map((c) =>
          c.id === child.id ? { ...c, status: child.status } : c,
        ),
      );
      toast.error(`Could not ${actionType.toLowerCase()} ${child.child_name}`, {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky header with search */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <div className="mx-auto max-w-xl px-4 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold leading-tight tracking-tight">
                GloryGate <span className="text-accent-foreground">Connect</span>
              </h1>
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Jesus Christ Hope of Glory Ministries
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                inputMode="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search child by name…"
                className="h-11 w-full rounded-xl border border-border bg-input pl-10 pr-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button
              type="button"
              onClick={() => setAddOpen(true)}
              className="h-11 shrink-0 rounded-xl px-3 font-semibold"
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Add New Child</span>
              <span className="sr-only sm:hidden">Add New Child</span>
            </Button>
          </div>

          <p
            suppressHydrationWarning
            className="mt-2 text-xs text-muted-foreground"
          >
            {counts.in} checked in · {counts.out} checked out
          </p>
        </div>
      </header>

      <AddChildDialog open={addOpen} onOpenChange={setAddOpen} />

      <main className="mx-auto max-w-xl px-4 py-4 pb-16">
        {filtered.length === 0 ? (
          <div className="mt-16 text-center text-muted-foreground">
            <Users className="mx-auto h-10 w-10 opacity-40" />
            <p className="mt-3 text-sm">
              {search ? "No children match your search." : "No children found."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((child) => (
              <ChildCard
                key={child.id}
                child={child}
                pending={pendingId === child.id}
                onAction={handleAction}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function ChildCard({
  child,
  pending,
  onAction,
}: {
  child: Child;
  pending: boolean;
  onAction: (child: Child, actionType: "Check In" | "Check Out") => void;
}) {
  const checkedIn = child.status === "checked_in";
  const phoneDigits = child.parent_phone.replace(/[^0-9]/g, "");
  const waHref = phoneDigits ? `https://wa.me/${phoneDigits}` : undefined;

  return (
    <li className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold">{child.child_name}</h2>
            <StatusPill status={child.status} />
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {child.parent_name}
          </p>
          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {child.parent_phone}
            </a>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">{child.parent_phone}</p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <ActionButton
          active={checkedIn}
          activeLabel="Checked In"
          idleLabel="Check In"
          tone="in"
          pending={pending}
          onClick={() => onAction(child, "Check In")}
        />
        <ActionButton
          active={!checkedIn}
          activeLabel="Checked Out"
          idleLabel="Check Out"
          tone="out"
          pending={pending}
          onClick={() => onAction(child, "Check Out")}
        />
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "checked_in") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-check-in-soft px-2 py-0.5 text-[11px] font-semibold text-check-in">
        <span className="h-1.5 w-1.5 rounded-full bg-check-in" />
        In
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-check-out-soft px-2 py-0.5 text-[11px] font-semibold text-check-out">
      <span className="h-1.5 w-1.5 rounded-full bg-check-out" />
      Out
    </span>
  );
}

function ActionButton({
  active,
  activeLabel,
  idleLabel,
  tone,
  pending,
  onClick,
}: {
  active: boolean;
  activeLabel: string;
  idleLabel: string;
  tone: "in" | "out";
  pending: boolean;
  onClick: () => void;
}) {
  const solid =
    tone === "in"
      ? "bg-check-in text-check-in-foreground"
      : "bg-check-out text-check-out-foreground";
  const outline =
    tone === "in"
      ? "border-2 border-check-in/40 text-check-in bg-check-in-soft/40"
      : "border-2 border-check-out/40 text-check-out bg-check-out-soft/40";

  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-60 ${
        active ? solid : outline
      }`}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : active ? (
        <Check className="h-4 w-4" />
      ) : tone === "in" ? (
        <LogIn className="h-4 w-4" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
      {active ? activeLabel : idleLabel}
    </button>
  );
}


function AddChildDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [childName, setChildName] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setChildName("");
    setParentName("");
    setParentPhone("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (childName.trim().length < 2 || parentName.trim().length < 2) {
      toast.error("Please enter both the child's and parent's full name.");
      return;
    }
    if (parentPhone.trim().replace(/[^0-9]/g, "").length < 6) {
      toast.error("Please enter a valid WhatsApp number.");
      return;
    }

    setSaving(true);
    try {
      await addChild({
        data: {
          childName: childName.trim(),
          parentName: parentName.trim(),
          parentPhone: parentPhone.trim(),
        },
      });
      await qc.invalidateQueries({ queryKey: ["children"] });
      toast.success(`${childName.trim()} added to the roster`);
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error("Could not add child", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Child</DialogTitle>
          <DialogDescription>
            Register a child and their parent's WhatsApp contact.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="child-name">Child's full name</Label>
            <Input
              id="child-name"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="e.g. Amara Dube"
              autoComplete="off"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parent-name">Parent's full name</Label>
            <Input
              id="parent-name"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="e.g. Grace Dube"
              autoComplete="off"
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parent-phone">Parent's WhatsApp number</Label>
            <Input
              id="parent-phone"
              type="tel"
              inputMode="tel"
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              placeholder="e.g. +27 82 123 4567"
              autoComplete="off"
              className="h-11"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-11 font-semibold" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save child
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
