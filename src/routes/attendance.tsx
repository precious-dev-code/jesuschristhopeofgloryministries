import { createFileRoute } from "@tanstack/react-router";
import {
  useQueryClient,
  useQuery,
  queryOptions,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Check,
  X,
  Users,
  Loader2,
  UserPlus,
  Phone,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { markAttendance, deleteMember } from "@/lib/members.functions";
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
import { AddMemberDialog, type EditableMember } from "@/components/AddMemberDialog";
import { AppNav } from "@/components/AppNav";

type Member = {
  id: string;
  member_name: string;
  phone: string;
  status: string;
  last_marked_at: string | null;
};

export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: "Member Attendance — GloryGate Connect" },
      {
        name: "description",
        content:
          "Mark members Present or Absent at Jesus Christ Hope of Glory Ministries with GloryGate Connect.",
      },
      { property: "og:title", content: "Member Attendance — GloryGate Connect" },
      {
        property: "og:description",
        content:
          "Simple member attendance tracking for Jesus Christ Hope of Glory Ministries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(membersQueryOptions()),
  component: AttendanceComponent,
});

const membersQueryOptions = () =>
  queryOptions({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .order("member_name", { ascending: true });
      if (error) throw error;
      return data as Member[];
    },
  });

function AttendanceComponent() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editMember, setEditMember] = useState<EditableMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const { data: members } = useQuery(membersQueryOptions());

  // Live updates across devices.
  useEffect(() => {
    const channel = supabase
      .channel("members-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "members" },
        () => {
          qc.invalidateQueries({ queryKey: ["members"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members ?? [];
    return (members ?? []).filter((m) =>
      m.member_name.toLowerCase().includes(q),
    );
  }, [members, search]);

  const counts = useMemo(() => {
    const list = members ?? [];
    return {
      present: list.filter((m) => m.status === "Present").length,
      absent: list.filter((m) => m.status === "Absent").length,
    };
  }, [members]);

  async function handleMark(member: Member, status: "Present" | "Absent") {
    if (member.status === status) return;

    setPendingId(member.id);
    // Optimistic update.
    qc.setQueryData<Member[]>(["members"], (prev) =>
      (prev ?? []).map((m) =>
        m.id === member.id
          ? { ...m, status, last_marked_at: new Date().toISOString() }
          : m,
      ),
    );

    try {
      await markAttendance({ data: { memberId: member.id, status } });
      toast.success(`${member.member_name} marked ${status.toLowerCase()}`, {
        description: "Make.com notified.",
      });
    } catch (err) {
      // Revert on failure.
      qc.setQueryData<Member[]>(["members"], (prev) =>
        (prev ?? []).map((m) =>
          m.id === member.id ? { ...m, status: member.status } : m,
        ),
      );
      toast.error(`Could not mark ${member.member_name}`, {
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
      await deleteMember({ data: { memberId: deleteTarget.id } });
      await qc.invalidateQueries({ queryKey: ["members"] });
      toast.success(`${deleteTarget.member_name} removed`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(`Could not remove ${deleteTarget.member_name}`, {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/70">
        <div className="mx-auto max-w-xl px-4 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold leading-tight tracking-tight">
                GloryGate <span className="text-accent">Connect</span>
              </h1>
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Member Attendance
              </p>
            </div>
          </div>

          <AppNav />

          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                inputMode="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search member by name…"
                className="h-11 w-full rounded-xl border border-border bg-input pl-10 pr-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button
              type="button"
              onClick={() => setAddOpen(true)}
              className="h-11 shrink-0 rounded-xl px-3 font-semibold"
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Member</span>
              <span className="sr-only sm:hidden">Add Member</span>
            </Button>
          </div>

          <p
            suppressHydrationWarning
            className="mt-2 text-xs text-muted-foreground"
          >
            {counts.present} present · {counts.absent} absent
          </p>
        </div>
      </header>

      <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} />
      <AddMemberDialog
        open={editMember !== null}
        onOpenChange={(open) => {
          if (!open) setEditMember(null);
        }}
        member={editMember}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.member_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the member from the attendance list.
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

      <main className="mx-auto max-w-xl px-4 py-4 pb-16">
        {!hydrated ? (
          <div className="mt-16 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-6 w-6 animate-spin opacity-60" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-16 text-center text-muted-foreground">
            <Users className="mx-auto h-10 w-10 opacity-40" />
            <p className="mt-3 text-sm">
              {search
                ? "No members match your search."
                : "No members yet. Tap \"Add Member\" to register one."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                pending={pendingId === member.id}
                onMark={handleMark}
                onEdit={() => setEditMember(member)}
                onDelete={() => setDeleteTarget(member)}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function MemberCard({
  member,
  pending,
  onMark,
  onEdit,
  onDelete,
}: {
  member: Member;
  pending: boolean;
  onMark: (member: Member, status: "Present" | "Absent") => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const present = member.status === "Present";
  const absent = member.status === "Absent";

  return (
    <li className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold">
              {member.member_name}
            </h2>
            {present ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-check-in-soft px-2 py-0.5 text-[11px] font-semibold text-check-in">
                <span className="h-1.5 w-1.5 rounded-full bg-check-in" />
                Present
              </span>
            ) : absent ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-check-out-soft px-2 py-0.5 text-[11px] font-semibold text-check-out">
                <span className="h-1.5 w-1.5 rounded-full bg-check-out" />
                Absent
              </span>
            ) : null}
          </div>
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            {member.phone}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <AttendanceButton
          active={present}
          activeLabel="Present"
          idleLabel="Present"
          tone="in"
          pending={pending}
          onClick={() => onMark(member, "Present")}
        />
        <AttendanceButton
          active={absent}
          activeLabel="Absent"
          idleLabel="Absent"
          tone="out"
          pending={pending}
          onClick={() => onMark(member, "Absent")}
        />
      </div>
    </li>
  );
}

function AttendanceButton({
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
        <Check className="h-4 w-4" />
      ) : (
        <X className="h-4 w-4" />
      )}
      {active ? activeLabel : idleLabel}
    </button>
  );
}
