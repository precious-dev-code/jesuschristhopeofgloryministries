import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FamilyShell } from "@/components/FamilyShell";
import "@lovable.dev/cloud-auth-js/styles.css";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Staff Sign In — GloryGate Connect" },
    { name: "description", content: "Staff sign-in for private church family records." },
    { property: "og:title", content: "Staff Sign In — GloryGate Connect" },
    { property: "og:description", content: "Private staff access at Jesus Christ Hope of Glory Ministries." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: StaffSignIn,
});
function StaffSignIn() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => { if (data.user) void navigate({ to: "/family" }); }); }, [navigate]);
  async function signIn(provider: "google" | "lovable") {
    setBusy(true); setError("");
    try {
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: `${window.location.origin}/auth` });
      if (result.error) throw result.error;
      if (!result.redirected) await navigate({ to: "/family" });
    } catch { setError("Sign-in did not complete. Please try again."); }
    finally { setBusy(false); }
  }
  return <FamilyShell><section className="mx-auto max-w-md py-8">
    <ShieldCheck className="mb-5 h-10 w-10 text-primary" />
    <h1 className="font-display text-3xl font-semibold">Staff sign in</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Family records are private. Your account must be approved by the church owner.</p>
    <div className="mt-8 grid gap-3">
      <Button variant="outline" className="h-12" disabled={busy} onClick={() => signIn("google")}>Continue with Google</Button>
      <Button className="lovable-auth-button h-12" disabled={busy} onClick={() => signIn("lovable")}>Continue with Lovable</Button>
    </div>
    {error && <p role="alert" className="mt-4 text-sm text-foreground">{error}</p>}
  </section></FamilyShell>;
}