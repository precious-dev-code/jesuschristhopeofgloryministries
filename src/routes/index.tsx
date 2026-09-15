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
  Pencil,
  Trash2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { recordCheckAction } from "@/lib/checkin.functions";
import { deleteChild } from "@/lib/children.functions";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AddChildDialog, type EditableChild } from "@/components/AddChildDialog";
import { AppNav } from "@/components/AppNav";
import { ChurchEntrance } from "@/components/ChurchEntrance";
import logoAsset from "@/assets/hope-of-glory-logo.jpg.asset.json";

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

/** Start of today in the usher's local timezone, as an ISO timestamp. */
function startOfTodayISO() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

/** Which actions each child already had recorded today ("Check In" / "Check Out"). */
const todayLogsQueryOptions = () =>
  queryOptions({
    queryKey: ["check-in-logs", "today"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("check_in_logs")
        .select("child_id, action_type")
        .gte("created_at", startOfTodayISO());
      if (error) throw error;
      return (data ?? []).map((r) => `${r.child_id}|${r.action_type}`);
    },
  });

function CheckInComponent() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [lessonTopic, setLessonTopic] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editChild, setEditChild] = useState<EditableChild | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Child | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [enteredChurch, setEnteredChurch] = useState(false);

  useEffect(() => {
    setHydrated(true);
    setEnteredChurch(window.sessionStorage.getItem("glorygate-entered") === "true");
  }, []);

  function enterChurch() {
    window.sessionStorage.setItem("glorygate-entered", "true");
    setEnteredChurch(true);
  }

  const { data: children } = useQuery(childrenQueryOptions());
  const { data: todayKeys } = useQuery({
    ...todayLogsQueryOptions(),
    enabled: hydrated,
  });

  const doneToday = useMemo(() => new Set(todayKeys ?? []), [todayKeys]);

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
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "check_in_logs" },
        () => {
          qc.invalidateQueries({ queryKey: ["check-in-logs", "today"] });
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
    // Locked for the rest of the day once this action was recorded today.
    if (doneToday.has(`${child.id}|${actionType}`)) return;

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
    qc.setQueryData<string[]>(["check-in-logs", "today"], (prev) => [
      ...(prev ?? []),
      `${child.id}|${actionType}`,
    ]);

    try {
      await recordCheckAction({ data: { childId: child.id, actionType, lessonTopic } });
      toast.success(`${child.child_name} ${actionType.toLowerCase()}`, {
        description: "Status synced and Make.com notified.",
      });
      qc.invalidateQueries({ queryKey: ["check-in-logs", "today"] });
    } catch (err) {
      // Revert optimistic updates on failure.
      qc.setQueryData<Child[]>(["children"], (prev) =>
        (prev ?? []).map((c) =>
          c.id === child.id ? { ...c, status: child.status } : c,
        ),
      );
      qc.setQueryData<string[]>(["check-in-logs", "today"], (prev) =>
        (prev ?? []).filter((k) => k !== `${child.id}|${actionType}`),
      );
      toast.error(`Could not ${actionType.toLowerCase()} ${child.child_name}`, {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      await deleteChild({ data: { childId: deleteTarget.id } });
      await qc.invalidateQueries({ queryKey: ["children"] });
      await qc.invalidateQueries({ queryKey: ["check-in-logs", "today"] });
      toast.success(`${deleteTarget.child_name} removed`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(`Could not remove ${deleteTarget.child_name}`, {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {hydrated && !enteredChurch ? <ChurchEntrance onEnter={enterChurch} /> : null}
      {/* Sticky header with search */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-2xl">
        <div className="mx-auto max-w-6xl px-4 pb-4 pt-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={logoAsset.url} alt="Jesus Christ Hope of Glory Ministries" className="h-12 w-12 shrink-0 rounded-full border border-primary/30 object-cover shadow-sanctuary" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-xl font-semibold leading-tight">
                GloryGate <span className="text-accent">Connect</span>
              </h1>
              <p className="truncate text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Kids Ministry Sanctuary
              </p>
            </div>
            <AppNav />
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

          <div className="mt-3">
            <label
              htmlFor="lesson-topic"
              className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Today&apos;s Bible Lesson Topic
            </label>
            <input
              id="lesson-topic"
              type="text"
              value={lessonTopic}
              onChange={(e) => setLessonTopic(e.target.value)}
              placeholder="e.g. The Good Samaritan"
              className="mt-1 h-11 w-full rounded-xl border border-border bg-input px-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
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
      <AddChildDialog
        open={editChild !== null}
        onOpenChange={(open) => {
          if (!open) setEditChild(null);
        }}
        child={editChild}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.child_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the child and their check-in history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-16 sm:px-6">
        {!hydrated ? (
          <div className="mt-16 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-6 w-6 animate-spin opacity-60" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-16 text-center text-muted-foreground">
            <Users className="mx-auto h-10 w-10 opacity-40" />
            <p className="mt-3 text-sm">
              {search
                ? "No children match your search."
                : "No children yet. Tap \"Add New Child\" to register one."}
            </p>
          </div>
        ) : (

          <ul className="grid gap-3 md:grid-cols-2">
            {filtered.map((child) => (
              <ChildCard
                key={child.id}
                child={child}
                pending={pendingId === child.id}
                lockedIn={doneToday.has(`${child.id}|Check In`)}
                lockedOut={doneToday.has(`${child.id}|Check Out`)}
                onAction={handleAction}
                onEdit={() => setEditChild(child)}
                onDelete={() => setDeleteTarget(child)}
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
  lockedIn,
  lockedOut,
  onAction,
  onEdit,
  onDelete,
}: {
  child: Child;
  pending: boolean;
  lockedIn: boolean;
  lockedOut: boolean;
  onAction: (child: Child, actionType: "Check In" | "Check Out") => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const checkedIn = child.status === "checked_in";
  const phoneDigits = child.parent_phone.replace(/[^0-9]/g, "");
  const waHref = phoneDigits ? `https://wa.me/${phoneDigits}` : undefined;

  return (
    <li className="sanctuary-card rounded-2xl border border-border bg-card p-4 shadow-sanctuary">
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
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${child.child_name}`}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Remove ${child.child_name}`}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-check-out-soft hover:text-check-out"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <ActionButton
          active={checkedIn}
          activeLabel="Checked In"
          idleLabel="Check In"
          tone="in"
          pending={pending}
          locked={lockedIn}
          onClick={() => onAction(child, "Check In")}
        />
        <ActionButton
          active={!checkedIn}
          activeLabel="Checked Out"
          idleLabel="Check Out"
          tone="out"
          pending={pending}
          locked={lockedOut}
          onClick={() => onAction(child, "Check Out")}
        />
      </div>
      {lockedIn || lockedOut ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          {lockedIn && lockedOut
            ? "Check in and check out already recorded today."
            : lockedIn
              ? "Check in already recorded today."
              : "Check out already recorded today."}{" "}
          Unlocks tomorrow.
        </p>
      ) : null}
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
  locked,
  onClick,
}: {
  active: boolean;
  activeLabel: string;
  idleLabel: string;
  tone: "in" | "out";
  pending: boolean;
  locked: boolean;
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
      disabled={pending || locked}
      onClick={onClick}
      className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
        active ? solid : outline
      }`}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : locked ? (
        <Lock className="h-4 w-4" />
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
