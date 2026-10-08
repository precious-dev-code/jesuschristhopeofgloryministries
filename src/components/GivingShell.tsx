import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HeartHandshake, History } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/hope-of-glory-logo.jpg.asset.json";

export function GivingShell({ children, history = false }: { children: ReactNode; history?: boolean }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          <img src={logoAsset.url} alt="Jesus Christ Hope of Glory Ministries" className="h-12 w-12 shrink-0 rounded-full border border-primary/30 object-cover shadow-sanctuary" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-xl font-semibold">GloryGate <span className="text-accent">Connect</span></p>
            <p className="text-xs text-muted-foreground">{history ? "Giving History" : "Give Now"}</p>
          </div>
          <AppNav />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <nav aria-label="Giving" className="mb-10 flex gap-2 border-b border-border pb-4">
          <Button asChild variant={history ? "ghost" : "secondary"} className={!history ? "text-primary" : "text-muted-foreground"}>
            <Link to="/give" aria-current={!history ? "page" : undefined}><HeartHandshake />Give Now</Link>
          </Button>
          <Button asChild variant={history ? "secondary" : "ghost"} className={history ? "text-primary" : "text-muted-foreground"}>
            <Link to="/giving-history" aria-current={history ? "page" : undefined}><History />Giving History</Link>
          </Button>
        </nav>
        {children}
      </main>
    </div>
  );
}