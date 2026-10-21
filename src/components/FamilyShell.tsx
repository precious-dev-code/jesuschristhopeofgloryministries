import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AppNav } from "@/components/AppNav";
import logoAsset from "@/assets/hope-of-glory-logo.jpg.asset.json";

export function FamilyShell({ children, signedIn = false }: { children: ReactNode; signedIn?: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }
  return <div className="min-h-screen bg-background text-foreground">
    <header className="border-b border-border bg-background/85">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
        <img src={logoAsset.url} alt="Jesus Christ Hope of Glory Ministries" className="h-12 w-12 shrink-0 rounded-full border border-primary/30 object-cover" />
        <div className="min-w-0 flex-1"><p className="font-display text-xl font-semibold">GloryGate <span className="text-accent">Connect</span></p><p className="text-xs text-muted-foreground">Family · Staff only</p></div>
        {signedIn && <Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut /></Button>}
        <AppNav />
      </div>
    </header>
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" className="mb-6"><Link to="/attendance"><ArrowLeft />Member Attendance</Link></Button>
      {children}
    </main>
  </div>;
}