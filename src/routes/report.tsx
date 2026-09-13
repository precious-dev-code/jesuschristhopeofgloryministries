import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Printer,
  Loader2,
  ChevronDown,
  Check,
  X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AppNav } from "@/components/AppNav";

type AttendanceRecord = {
  id: string;
  member_id: string | null;
  member_name: string;
  phone: string | null;
  attendance_date: string;
  status: string;
  marked_at: string;
};

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Sunday Report — GloryGate Connect" },
      {
        name: "description",
        content:
          "Printable Sunday attendance report for Jesus Christ Hope of Glory Ministries with Present, Absent and Total per service.",
      },
      { property: "og:title", content: "Sunday Report — GloryGate Connect" },
      {
        property: "og:description",
        content:
          "Dated attendance register report for Jesus Christ Hope of Glory Ministries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(allRecordsQueryOptions()),
  component: ReportComponent,
});

const allRecordsQueryOptions = () =>
  queryOptions({
    queryKey: ["attendance_records", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .order("attendance_date", { ascending: false })
        .order("member_name", { ascending: true });
      if (error) throw error;
      return data as AttendanceRecord[];
    },
  });

function formatDay(day: string) {
  const d = new Date(`${day}T12:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type DayGroup = {
  day: string;
  present: AttendanceRecord[];
  absent: AttendanceRecord[];
};

function ReportComponent() {
  const qc = useQueryClient();
  const [hydrated, setHydrated] = useState(false);
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());

  useEffect(() => {
    setHydrated(true);
  }, []);

  const { data: records } = useQuery(allRecordsQueryOptions());

  // Live updates so the report always reflects the latest register.
  useEffect(() => {
    const channel = supabase
      .channel("attendance-report")
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

  const days = useMemo<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>();
    for (const r of records ?? []) {
      let g = map.get(r.attendance_date);
      if (!g) {
        g = { day: r.attendance_date, present: [], absent: [] };
        map.set(r.attendance_date, g);
      }
      if (r.status === "Present") g.present.push(r);
      else if (r.status === "Absent") g.absent.push(r);
    }
    return [...map.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
  }, [records]);

  function toggleDay(day: string) {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground print:bg-white">
      <header className="sticky top-0 z-10 border-b border-border bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/70 print:hidden">
        <div className="mx-auto max-w-xl px-4 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold leading-tight tracking-tight">
                GloryGate <span className="text-accent">Connect</span>
              </h1>
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Sunday Report
              </p>
            </div>
            <Button
              type="button"
              onClick={() => window.print()}
              className="h-11 shrink-0 rounded-xl px-4 font-semibold"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
              <span className="sr-only sm:hidden">Print report</span>
            </Button>
          </div>

          <AppNav />
        </div>
      </header>

      {/* Print-only heading */}
      <div className="hidden print:block px-6 pt-6 text-black">
        <h1 className="text-xl font-bold">Jesus Christ Hope of Glory Ministries</h1>
        <p className="text-sm text-gray-600">
          Member Attendance — Sunday Report · Printed{" "}
          {new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <main className="mx-auto max-w-xl px-4 py-4 pb-16 print:max-w-none print:px-6 print:py-4">
        {!hydrated ? (
          <div className="mt-16 text-center text-muted-foreground print:hidden">
            <Loader2 className="mx-auto h-6 w-6 animate-spin opacity-60" />
          </div>
        ) : days.length === 0 ? (
          <div className="mt-16 text-center text-muted-foreground">
            <BarChart3 className="mx-auto h-10 w-10 opacity-40" />
            <p className="mt-3 text-sm">
              No attendance recorded yet. Mark members on the Member Attendance
              page and each Sunday will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3 print:space-y-4">
            {days.map((g) => {
              const total = g.present.length + g.absent.length;
              const open = openDays.has(g.day);
              return (
                <li
                  key={g.day}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm print:break-inside-avoid print:rounded-none print:border-0 print:border-b print:border-gray-300 print:bg-white print:p-0 print:pb-4 print:shadow-none"
                >
                  <button
                    type="button"
                    onClick={() => toggleDay(g.day)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold print:text-black">
                        {formatDay(g.day)}
                      </h2>
                      <p className="mt-0.5 text-xs text-muted-foreground print:text-gray-600">
                        {total} member{total === 1 ? "" : "s"} recorded
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform print:hidden ${open ? "rotate-180" : ""}`}
                    />
                  </button>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-check-in-soft px-2 py-2 print:border print:border-gray-300 print:bg-white">
                      <p className="text-xl font-bold text-check-in print:text-black">
                        {g.present.length}
                      </p>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-check-in print:text-gray-600">
                        Present
                      </p>
                    </div>
                    <div className="rounded-xl bg-check-out-soft px-2 py-2 print:border print:border-gray-300 print:bg-white">
                      <p className="text-xl font-bold text-check-out print:text-black">
                        {g.absent.length}
                      </p>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-check-out print:text-gray-600">
                        Absent
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted px-2 py-2 print:border print:border-gray-300 print:bg-white">
                      <p className="text-xl font-bold text-accent print:text-black">
                        {total}
                      </p>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground print:text-gray-600">
                        Total
                      </p>
                    </div>
                  </div>

                  {/* Name lists: toggle on screen, always shown when printing */}
                  <div className={`${open ? "" : "hidden"} print:block`}>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-check-in print:text-black">
                          <Check className="h-3.5 w-3.5" /> Present
                        </p>
                        {g.present.length === 0 ? (
                          <p className="text-xs text-muted-foreground print:text-gray-600">
                            None
                          </p>
                        ) : (
                          <ul className="space-y-0.5">
                            {g.present.map((r) => (
                              <li
                                key={r.id}
                                className="text-sm print:text-black"
                              >
                                {r.member_name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div>
                        <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-check-out print:text-black">
                          <X className="h-3.5 w-3.5" /> Absent
                        </p>
                        {g.absent.length === 0 ? (
                          <p className="text-xs text-muted-foreground print:text-gray-600">
                            None
                          </p>
                        ) : (
                          <ul className="space-y-0.5">
                            {g.absent.map((r) => (
                              <li
                                key={r.id}
                                className="text-sm print:text-black"
                              >
                                {r.member_name}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
