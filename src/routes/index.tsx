import { createFileRoute } from "@tanstack/react-router";
import {
  useQueryClient,
  useQuery,
  queryOptions,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Search, LogIn, LogOut, MessageCircle, Users, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { recordCheckAction } from "@/lib/checkin.functions";

type Child = Database["public"]["Tables"]["children"]["Row"];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kids Ministry Check-In" },
      {
        name: "description",
        content:
          "Mobile-friendly check-in and check-out for church kids ministry ushers.",
      },
      { property: "og:title", content: "Kids Ministry Check-In" },
      {
        property: "og:description",
        content: "Check in and check out children for church kids ministry.",
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
  const runCheckAction = useServerFn(recordCheckAction);
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

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
      await runCheckAction({ data: { childId: child.id, actionType } });
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
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Users className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold leading-tight tracking-tight">
                Kids Ministry Check-In
              </h1>
              <p className="text-xs text-muted-foreground">
                {counts.in} checked in · {counts.out} checked out
              </p>
            </div>
          </div>

          <div className="relative mt-3">
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
        </div>
      </header>

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

