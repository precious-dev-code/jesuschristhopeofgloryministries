import { ArrowDown, DoorOpen } from "lucide-react";

import churchExterior from "@/assets/church-exterior.jpg";
import logoAsset from "@/assets/hope-of-glory-logo.jpg.asset.json";
import { Button } from "@/components/ui/button";

export function ChurchEntrance({ onEnter }: { onEnter: () => void }) {
  return (
    <main className="church-entrance fixed inset-0 z-50 overflow-hidden bg-background">
      <img
        src={churchExterior}
        alt="A grand illuminated church entrance at blue hour"
        width={1536}
        height={1920}
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-linear-to-b from-background/35 via-background/5 to-background/85" />
      <div className="absolute inset-x-0 top-0 h-2/5 bg-linear-to-b from-background/70 to-transparent" />

      <div className="relative flex h-full flex-col items-center px-5 pb-8 pt-[max(2rem,env(safe-area-inset-top))] text-center">
        <div className="entrance-brand animate-fade-in flex max-w-3xl flex-col items-center">
          <img
            src={logoAsset.url}
            alt="Jesus Christ Hope of Glory Ministries logo"
            className="h-28 w-28 rounded-full border border-primary/35 object-cover shadow-sanctuary sm:h-36 sm:w-36"
          />
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-primary sm:text-xs">
            Welcome to
          </p>
          <h1 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-tight text-foreground drop-shadow-2xl sm:text-5xl lg:text-6xl">
            Jesus Christ Hope of Glory Ministries
          </h1>
        </div>

        <div className="mt-auto flex flex-col items-center">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-foreground/80">
            Come in · You are welcome
          </p>
          <Button
            type="button"
            onClick={onEnter}
            className="entrance-button h-14 rounded-full border border-primary/60 bg-primary px-8 text-sm font-bold uppercase tracking-widest text-primary-foreground shadow-sanctuary transition-transform duration-300 hover:scale-[1.03] hover:bg-primary/90"
          >
            <DoorOpen className="h-5 w-5" />
            Enter Church
          </Button>
          <ArrowDown className="mt-4 h-4 w-4 animate-bounce text-primary" aria-hidden="true" />
        </div>
      </div>
    </main>
  );
}