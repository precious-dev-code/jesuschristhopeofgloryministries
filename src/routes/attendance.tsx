import { createFileRoute, Link } from "@tanstack/react-router";
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
  Lock,
  CalendarDays,

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
import logoAsset from "@/assets/hope-of-glory-logo.jpg.asset.json";

type Member = {
  id: string;
  member_name: string;
  phone: string | null;
  status: string;
  last_marked_at: string | null;
};

type AttendanceRecord = {
  id: string;
  member_id: string | null;
  member_name: string;
  phone: string | null;
  attendance_date: string;
  status: string;
  marked_at: string;
};

/** Local calendar day as YYYY-MM-DD. */
function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}



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

const recordsQueryOptions = (day: string) =>
  queryOptions({
    queryKey: ["attendance_records", day],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("attendance_date", day)
        .order("marked_at", { ascending: false });
      if (error) throw error;
      return data as AttendanceRecord[];
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
  const [today, setToday] = useState(() => localDay());
  const [selectedDay, setSelectedDay] = useState(() => localDay());

  useEffect(() => {
    setHydrated(true);
    setToday(localDay());
    setSelectedDay(localDay());
  }, []);

  const { data: members } = useQuery(membersQueryOptions());
  const { data: selectedRecords } = useQuery(recordsQueryOptions(selectedDay));
  const { data: todayRecords } = useQuery(recordsQueryOptions(today));

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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records" },
        () => {
          qc.invalidateQueries({ queryKey: ["attendance_records"] });
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

  /** Members already recorded today -> their recorded status (drives the lock). */
  const todayStatus = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of todayRecords ?? []) {
      if (r.member_id) map.set(r.member_id, r.status);
    }
    return map;
  }, [todayRecords]);

  // Dashboard counts come from the dated register, not the member list.
  const counts = useMemo(() => {
    const list = selectedRecords ?? [];
    const present = list.filter((r) => r.status === "Present").length;
    const absent = list.filter((r) => r.status === "Absent").length;
    return { present, absent, total: present + absent };
  }, [selectedRecords]);

  async function handleMark(member: Member, status: "Present" | "Absent") {
    // Locked for the rest of the day once attendance was recorded today.
    if (todayStatus.has(member.id)) return;

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
      await markAttendance({
        data: { memberId: member.id, status, date: today },
      });
      await qc.invalidateQueries({ queryKey: ["attendance_records"] });
      toast.success(`${member.member_name} marked ${status.toLowerCase()}`, {
        description: "Saved to the attendance register.",
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
      await deleteMember({ data: { memberId: deleteTarget.id, date: today } });
      await qc.invalidateQueries({ queryKey: ["members"] });
      await qc.invalidateQueries({ queryKey: ["attendance_records"] });
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
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-2xl">
        <div className="mx-auto max-w-6xl px-4 pb-4 pt-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={logoAsset.url} alt="Jesus Christ Hope of Glory Ministries" className="h-12 w-12 shrink-0 rounded-full border border-primary/30 object-cover shadow-sanctuary" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-xl font-semibold leading-tight">
                GloryGate <span className="text-accent">Connect</span>
              </h1>
              <p className="truncate text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Member Attendance
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
          <Button asChild variant="ghost" className="mt-2"><Link to="/family"><Users className="h-4 w-4" />Family · Staff</Link></Button>

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

<main className="mx-auto max-w-6xl px-4 py-6 pb-16 sm:px-6">
        <AttendanceDashboard
          present={counts.present}
          absent={counts.absent}
          total={counts.total}
          selectedDay={selectedDay}
          today={today}
          onSelectDay={setSelectedDay}
          records={selectedRecords ?? []}
        />


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
          <ul className="grid gap-3 md:grid-cols-2">
            {filtered.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                recordedToday={todayStatus.get(member.id) ?? null}
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
  recordedToday,
  pending,
  onMark,
  onEdit,
  onDelete,
}: {
  member: Member;
  recordedToday: string | null;
  pending: boolean;
  onMark: (member: Member, status: "Present" | "Absent") => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const present = recordedToday === "Present";
  const absent = recordedToday === "Absent";
  const locked = recordedToday !== null;



  return (
    <li className="sanctuary-card rounded-2xl border border-border bg-card p-4 shadow-sanctuary">
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
          {member.phone ? (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              {member.phone}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button asChild variant="ghost" size="icon" title="View family"><Link to="/family" search={{ member: member.id }} aria-label={`Family of ${member.member_name}`}><Users className="h-4 w-4" /></Link></Button>
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${member.member_name}`}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Remove ${member.member_name}`}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-check-out-soft hover:text-check-out"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <AttendanceButton
          active={present}
          activeLabel="Present"
          idleLabel="Present"
          tone="in"
          pending={pending}
          locked={locked}
          onClick={() => onMark(member, "Present")}
        />
        <AttendanceButton
          active={absent}
          activeLabel="Absent"
          idleLabel="Absent"
          tone="out"
          pending={pending}
          locked={locked}
          onClick={() => onMark(member, "Absent")}
        />
      </div>
      {locked ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          Attendance already recorded today. Unlocks tomorrow.
        </p>
      ) : null}
    </li>
  );
}


function AttendanceButton({
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
        <Check className="h-4 w-4" />
      ) : (
        <X className="h-4 w-4" />
      )}
{active ? activeLabel : idleLabel}
    </button>
  );
}

function AttendanceDashboard({
  present,
  absent,
  total,
  selectedDay,
  today,
  onSelectDay,
  records,
}: {
  present: number;
  absent: number;
  total: number;
  selectedDay: string;
  today: string;
  onSelectDay: (day: string) => void;
  records: AttendanceRecord[];
}) {
  const [showRecords, setShowRecords] = useState(false);
  const isToday = selectedDay === today;

  const stats = [
    {
      label: "Present",
      value: present,
      icon: Check,
      chip: "bg-check-in-soft text-check-in",
      valueClass: "text-check-in",
    },
    {
      label: "Absent",
      value: absent,
      icon: X,
      chip: "bg-check-out-soft text-check-out",
      valueClass: "text-check-out",
    },
    {
      label: "Recorded",
      value: total,
      icon: Users,
      chip: "bg-primary/15 text-primary",
      valueClass: "text-foreground",
    },
  ];

  return (
    <section aria-label="Attendance dashboard" className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <CalendarDays className="h-4 w-4 text-accent" />
          Attendance date
        </label>
        <div className="flex items-center gap-2">
          {!isToday ? (
            <button
              type="button"
              onClick={() => onSelectDay(today)}
              className="rounded-lg px-2 py-1 text-[11px] font-semibold text-accent hover:bg-muted"
            >
              Today
            </button>
          ) : null}
          <input
            type="date"
            value={selectedDay}
            max={today}
            onChange={(e) => onSelectDay(e.target.value || today)}
            className="h-9 rounded-xl border border-border bg-input px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border bg-card p-3 shadow-sm"
          >
            <div
              className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${stat.chip}`}
            >
              <stat.icon className="h-4 w-4" />
            </div>
            <p
              suppressHydrationWarning
              className={`mt-2 text-2xl font-bold leading-none tabular-nums ${stat.valueClass}`}
            >
              {stat.value}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowRecords((v) => !v)}
        className="mt-2 flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground shadow-sm"
      >
        <span>
          {isToday ? "Today's register" : `Register for ${selectedDay}`}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {showRecords ? "Hide" : `View (${records.length})`}
        </span>
      </button>

      {showRecords ? (
        records.length === 0 ? (
          <p className="mt-2 rounded-xl border border-border bg-card px-3 py-4 text-center text-sm text-muted-foreground">
            No attendance recorded on this date.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {records.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.member_name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {r.phone ? `${r.phone} • ` : ""}
                    {new Date(r.marked_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    r.status === "Present"
                      ? "bg-check-in-soft text-check-in"
                      : "bg-check-out-soft text-check-out"
                  }`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}


