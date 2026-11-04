import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HeartHandshake, History, ShieldCheck } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import logoAsset from "@/assets/hope-of-glory-logo.jpg.asset.json";

export function GivingShell({ children, history = false }: { children: ReactNode; history?: boolean }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-6 sm:px-6">
          <img src={logoAsset.url} alt="Jesus Christ Hope of Glory Ministries logo" className="h-20 w-20 shrink-0 rounded-lg border border-primary/30 object-contain shadow-sanctuary" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold leading-snug sm:text-2xl">Jesus Christ Hope of Glory Ministries</p>
            <p className="mt-2 text-sm text-primary">{history ? "Giving History" : "Online Giving"}</p>
          </div>
          {history ? <AppNav /> : null}
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {history ? <nav aria-label="Giving" className="mb-10 flex gap-2 border-b border-border pb-4">
          <Button asChild variant="ghost" className="text-muted-foreground">
            <Link to="/give"><HeartHandshake />Give Now</Link>
          </Button>
          <Button asChild variant="secondary" className="text-primary">
            <Link to="/giving-history" aria-current="page"><History />Giving History</Link>
          </Button>
        </nav> : null}
        {children}
      </main>
      {!history ? <footer className="mx-auto flex max-w-xl items-center justify-center gap-2 border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />Payments processed securely by Paystack
      </footer> : null}
    </div>
  );
}
