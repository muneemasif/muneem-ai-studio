import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { chatWithSolo, generateImage } from "@/lib/gemini.functions";
import {
  ensureThreadExists,
  upsertMessages,
  useThread,
  uid,
  type Attachment,
  type StoredMessage,
} from "@/lib/history";
import logoAsset from "@/assets/muneem-ai-logo.png.asset.json";

type Message = StoredMessage & { streaming?: boolean; reveal?: number };

function fileToAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve({
        mimeType: file.type || "application/octet-stream",
        data: base64,
        name: file.name,
        kind: file.type.startsWith("image/") ? "image" : "file",
        previewUrl: result,
      });
    };
    reader.readAsDataURL(file);
  });
}

export function ChatView({ threadId }: { threadId: string }) {
  const thread = useThread(threadId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Ensure thread exists on mount, hydrate from storage
  useEffect(() => {
    ensureThreadExists(threadId);
  }, [threadId]);

  useEffect(() => {
    if (thread) setMessages(thread.messages);
    else setMessages([]);
    // Reset UI on thread switch
    setInput("");
    setPending([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading, threadId]);

  const persist = (msgs: Message[]) => {
    const clean: StoredMessage[] = msgs.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      attachments: m.attachments,
    }));
    const firstUser = clean.find((m) => m.role === "user");
    upsertMessages(threadId, clean, firstUser?.content);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr: Attachment[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 8 * 1024 * 1024) continue; // 8MB cap
      arr.push(await fileToAttachment(f));
    }
    setPending((p) => [...p, ...arr]);
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && pending.length === 0) || loading) return;

    const userMsg: Message = {
      id: uid(),
      role: "user",
      content: text,
      createdAt: Date.now(),
      attachments: pending.length ? pending : undefined,
    };
    const next = [...messages, userMsg];
    setMessages(next);
    persist(next);
    setInput("");
    setPending([]);
    setLoading(true);

    try {
      if (imageMode) {
        const res = await generateImage({ data: { prompt: text || "an image" } });
        const id = uid();
        const asst: Message = {
          id,
          role: "assistant",
          content: res.text || "Here you go 🎨",
          createdAt: Date.now(),
          attachments: [
            {
              mimeType: res.image.split(";")[0].replace("data:", ""),
              data: res.image.split(",")[1] ?? "",
              kind: "generated-image",
              previewUrl: res.image,
              name: "generated.png",
            },
          ],
        };
        const after = [...next, asst];
        setMessages(after);
        persist(after);
      } else {
        const res = await chatWithSolo({
          data: {
            messages: next.map((m) => ({
              role: m.role,
              content: m.content,
              attachments: m.attachments
                ?.filter((a) => a.kind !== "generated-image")
                .map((a) => ({ mimeType: a.mimeType, data: a.data, name: a.name })),
            })),
          },
        });
        const reply = res.text || "…";
        const id = uid();
        const asst: Message = {
          id,
          role: "assistant",
          content: reply,
          createdAt: Date.now(),
          streaming: true,
          reveal: 0,
        };
        const after = [...next, asst];
        setMessages(after);

        // Typewriter reveal
        const total = reply.length;
        const targetMs = 500;
        const frameMs = 16;
        const step = Math.max(6, Math.ceil(total / (targetMs / frameMs)));
        let i = 0;
        const tick = () => {
          i = Math.min(total, i + step);
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, reveal: i } : m)),
          );
          if (i < total) requestAnimationFrame(tick);
          else {
            const finalMsgs = after.map((m) =>
              m.id === id ? { ...m, streaming: false, reveal: total } : m,
            );
            setMessages(finalMsgs);
            persist(finalMsgs);
          }
        };
        requestAnimationFrame(tick);
      }
    } catch (err) {
      const errMsg: Message = {
        id: uid(),
        role: "assistant",
        content:
          "Sorry — something went wrong.\n\n> " +
          (err instanceof Error ? err.message : String(err)),
        createdAt: Date.now(),
      };
      const after = [...next, errMsg];
      setMessages(after);
      persist(after);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const suggestions = [
    "Explain Fourier transforms with an example",
    "Solve step by step: integral of x·e^x dx",
    "What's a clean way to structure a React app?",
  ];

  return (
    <section className="flex h-full w-full flex-col">
      <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <Empty suggestions={suggestions} onPick={(s) => setInput(s)} />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5 px-3 py-5 sm:gap-6 sm:px-6 sm:py-8">
            {messages.map((m) => (
              <MessageBubble key={m.id} m={m} />
            ))}
            {loading && <Typing label={imageMode ? "Creating image…" : undefined} />}
          </div>
        )}
      </div>

      <div className="border-t border-border/60 bg-background/70 px-3 py-3 backdrop-blur sm:px-4 sm:py-4">
        <div className="mx-auto max-w-3xl">
          {pending.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {pending.map((a, i) => (
                <div
                  key={i}
                  className="relative flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1 text-xs"
                >
                  {a.kind === "image" && a.previewUrl ? (
                    <img src={a.previewUrl} alt="" className="h-8 w-8 rounded object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-[10px]">
                      FILE
                    </div>
                  )}
                  <span className="max-w-[10rem] truncate text-muted-foreground">{a.name}</span>
                  <button
                    onClick={() => setPending((p) => p.filter((_, j) => j !== i))}
                    className="ml-1 text-muted-foreground hover:text-destructive"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="group flex items-end gap-2 rounded-2xl border border-border bg-card px-2 py-2 transition-all focus-within:border-primary/60 focus-within:glow-ring">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.md,.json,.csv"
              className="hidden"
              onChange={(e) => {
                onFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="Attach file"
              title="Attach image or file"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <button
              onClick={() => setImageMode((v) => !v)}
              className={`flex h-9 shrink-0 items-center gap-1 rounded-xl px-2.5 text-xs font-medium transition ${
                imageMode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              title="Toggle image generation"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              Image
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={imageMode ? "Describe an image to create…" : "Ask anything — math, code, ideas…"}
              rows={1}
              className="max-h-40 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
              style={{ minHeight: 40 }}
            />
            <button
              onClick={send}
              disabled={loading || (!input.trim() && pending.length === 0)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-1 px-1 text-[10px] text-muted-foreground sm:text-[11px]">
            <span>{imageMode ? "Image mode · describe what to draw" : "Aura AI · minimal & fast"}</span>
            <span className="opacity-70 hidden sm:inline">Enter to send · Shift+Enter for newline</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Empty({ suggestions, onPick }: { suggestions: string[]; onPick: (s: string) => void }) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-5 text-center sm:px-6">
      <div className="fade-up mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white overflow-hidden glow-ring sm:mb-6">
        <img src={logoAsset.url} alt="Aura AI" className="h-full w-full object-contain invert" />
      </div>
      <h1 className="fade-up text-2xl font-semibold tracking-tight sm:text-3xl" style={{ animationDelay: "60ms" }}>
        Ask Aura AI anything.
      </h1>
      <p className="fade-up mt-2 max-w-md text-sm text-muted-foreground" style={{ animationDelay: "120ms" }}>
        Chat, attach images or files, or generate images. Math renders in LaTeX.
      </p>
      <div className="fade-up mt-6 grid w-full gap-2 sm:mt-8 sm:grid-cols-3" style={{ animationDelay: "180ms" }}>
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-xl border border-border bg-card p-3 text-left text-xs text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground hover:-translate-y-0.5"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ m }: { m: Message }) {
  const isUser = m.role === "user";
  const display =
    m.role === "assistant" && m.reveal !== undefined
      ? m.content.slice(0, m.reveal)
      : m.content;
  return (
    <div className={`fade-up flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[92%] gap-2 sm:max-w-[85%] sm:gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
        <div
          className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-semibold ${
            isUser ? "bg-accent text-accent-foreground" : "bg-white"
          }`}
        >
          {isUser ? "You" : <img src={logoAsset.url} alt="A" className="h-full w-full object-contain invert" />}
        </div>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:px-4 ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-card text-card-foreground border border-border/60"
          }`}
        >
          {m.attachments && m.attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {m.attachments.map((a, i) =>
                a.previewUrl && (a.kind === "image" || a.kind === "generated-image") ? (
                  <a
                    key={i}
                    href={a.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <img
                      src={a.previewUrl}
                      alt={a.name ?? "image"}
                      className="max-h-64 max-w-full rounded-lg border border-border/40 object-contain"
                    />
                  </a>
                ) : (
                  <div
                    key={i}
                    className="rounded-md border border-border/40 bg-background/40 px-2 py-1 text-xs"
                  >
                    📎 {a.name}
                  </div>
                ),
              )}
            </div>
          )}
          {isUser ? (
            display && <div className="whitespace-pre-wrap">{display}</div>
          ) : (
            <div className="prose-solo">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {display}
              </ReactMarkdown>
              {m.streaming && (
                <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 bg-foreground animate-pulse" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Typing({ label }: { label?: string }) {
  return (
    <div className="fade-up flex items-center gap-3">
      <div className="mt-1 flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-white">
        <img src={logoAsset.url} alt="A" className="h-full w-full object-contain invert" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3">
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        {label && <span className="ml-1 text-[11px] text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}