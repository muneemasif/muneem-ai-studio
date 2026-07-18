import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import logoAsset from "@/assets/muneem-ai-logo.png.asset.json";

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  return (
    <div className="grain relative flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      <div className="relative z-10 hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border/60 px-3 py-3 backdrop-blur-sm sm:px-6">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setOpen(true)}
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground md:hidden"
              aria-label="Open sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <div className="flex items-center gap-2.5 min-w-0 md:hidden">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                <img src={logoAsset.url} alt="Aura AI" className="h-full w-full object-contain invert" />
              </div>
              <div className="truncate text-sm font-semibold">Aura AI</div>
            </div>
          </div>
          <button
            onClick={() => setShowAbout(true)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            About
          </button>
        </header>

        <div className="flex-1 overflow-hidden">{children}</div>
      </div>

      {showAbout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm fade-up p-4"
          onClick={() => setShowAbout(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white glow-ring">
                <img src={logoAsset.url} alt="Aura AI" className="h-full w-full object-contain invert" />
              </div>
              <div>
                <div className="text-base font-semibold">Aura AI</div>
                <div className="text-xs text-muted-foreground">A quiet, capable assistant.</div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Aura AI is crafted by <span className="text-foreground font-medium">Muneem Asif</span>,
              a BSCS student at <span className="text-foreground font-medium">UCP Lahore</span>
              {" "}(University of Central Punjab). Chat, attach images or files, and generate images —
              all with a calm, minimal, black-and-white feel.
            </p>
            <button
              onClick={() => setShowAbout(false)}
              className="mt-5 w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground transition hover:brightness-110"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}