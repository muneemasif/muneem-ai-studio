import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useHistory, createThread, deleteThread } from "@/lib/history";
import logoAsset from "@/assets/muneem-ai-logo.png.asset.json";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { threads } = useHistory();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const activeId = params.threadId;

  const newChat = () => {
    const t = createThread();
    navigate({ to: "/c/$threadId", params: { threadId: t.id } });
    onNavigate?.();
  };

  const remove = (id: string) => {
    deleteThread(id);
    if (id === activeId) navigate({ to: "/" });
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border/60 bg-card/40 backdrop-blur">
      <div className="flex items-center gap-2.5 border-b border-border/60 px-3 py-3">
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white">
          <img src={logoAsset.url} alt="Aura AI" className="h-full w-full object-contain invert" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">Aura AI</div>
          <div className="truncate text-[10px] text-muted-foreground">by Muneem Asif</div>
        </div>
      </div>

      <button
        onClick={newChat}
        className="mx-3 mt-3 flex items-center justify-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs font-medium text-foreground transition hover:bg-accent"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        New chat
      </button>

      <div className="scrollbar-thin mt-3 flex-1 overflow-y-auto px-2 pb-3">
        {threads.length === 0 ? (
          <div className="px-2 py-4 text-center text-[11px] text-muted-foreground">
            No chats yet
          </div>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {threads.map((t) => {
              const isActive = t.id === activeId;
              return (
                <li key={t.id} className="group relative">
                  <Link
                    to="/c/$threadId"
                    params={{ threadId: t.id }}
                    onClick={() => onNavigate?.()}
                    className={`block truncate rounded-md px-2.5 py-2 pr-8 text-xs transition ${
                      isActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    }`}
                  >
                    {t.title || "New chat"}
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      remove(t.id);
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-background hover:text-destructive group-hover:opacity-100"
                    aria-label="Delete chat"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-border/60 px-3 py-2 text-[10px] text-muted-foreground">
        History saved in this browser
      </div>
    </aside>
  );
}