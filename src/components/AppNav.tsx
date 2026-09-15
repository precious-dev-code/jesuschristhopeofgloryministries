import { Link, useRouterState } from "@tanstack/react-router";
import { Baby, BarChart3, ClipboardList, Menu } from "lucide-react";

import logoAsset from "@/assets/hope-of-glory-logo.jpg.asset.json";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const items = [
  { title: "Kids Check-In", subtitle: "Children's ministry register", url: "/", icon: Baby },
  { title: "Member Attendance", subtitle: "Sunday attendance register", url: "/attendance", icon: ClipboardList },
  { title: "Sunday Report", subtitle: "Dated records and printing", url: "/report", icon: BarChart3 },
] as const;

export function AppNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-11 shrink-0 rounded-full border-primary/35 bg-background/50 px-4 text-xs font-semibold uppercase tracking-widest text-primary backdrop-blur-xl hover:bg-primary hover:text-primary-foreground"
          aria-label="Open church menu"
        >
          <Menu className="h-4 w-4" />
          Menu
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[88vw] border-l border-primary/25 bg-background/95 p-0 backdrop-blur-3xl sm:max-w-md">
        <div className="h-1 bg-linear-to-r from-transparent via-primary to-transparent opacity-70" />
        <div className="flex h-full flex-col px-6 pb-8 pt-10">
          <SheetHeader className="items-center text-center">
            <img
              src={logoAsset.url}
              alt="Jesus Christ Hope of Glory Ministries"
              className="h-28 w-28 rounded-full border border-primary/25 object-cover shadow-sanctuary"
            />
            <SheetTitle className="font-display text-2xl font-semibold text-foreground">
              GloryGate <span className="text-primary">Connect</span>
            </SheetTitle>
            <SheetDescription className="text-xs uppercase tracking-widest text-muted-foreground">
              Jesus Christ Hope of Glory Ministries
            </SheetDescription>
          </SheetHeader>

          <nav className="mt-10 space-y-3" aria-label="Main menu">
            {items.map((item) => {
              const active = pathname === item.url;
              return (
                <SheetClose asChild key={item.url}>
                  <Link
                    to={item.url}
                    activeOptions={{ exact: item.url === "/" }}
                    className={`group flex min-h-20 items-center gap-4 rounded-2xl border px-4 py-3 transition-all duration-300 ${
                      active
                        ? "border-primary/45 bg-primary/12 text-foreground shadow-sanctuary"
                        : "border-border bg-card/55 text-muted-foreground hover:border-primary/30 hover:bg-card"
                    }`}
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}>
                      <item.icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 text-left">
                      <span className="block font-display text-base font-semibold text-foreground">{item.title}</span>
                      <span className="mt-0.5 block text-xs">{item.subtitle}</span>
                    </span>
                  </Link>
                </SheetClose>
              );
            })}
          </nav>

          <p className="mt-auto border-t border-primary/15 pt-5 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
            Colossians 1:27 · Hope of Glory
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}