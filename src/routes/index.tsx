import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Shell } from "@/components/Shell";
import { useThreads, uid, ensureThreadExists } from "@/lib/history";
import logoAsset from "@/assets/muneem-ai-logo.png.asset.json";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const threads = useThreads();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (threads.length > 0) {
      navigate({ to: "/c/$threadId", params: { threadId: threads[0].id }, replace: true });
    } else {
      const id = uid();
      ensureThreadExists(id);
      navigate({ to: "/c/$threadId", params: { threadId: id }, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Shell>
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div className="fade-up">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white glow-ring">
            <img src={logoAsset.url} alt="Aura AI" className="h-full w-full object-contain invert" />
          </div>
          <p className="text-sm text-muted-foreground">Opening Aura AI…</p>
        </div>
      </div>
    </Shell>
  );
}
