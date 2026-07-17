import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { chatWithSolo } from "@/lib/gemini.functions";
import logoAsset from "@/assets/muneem-ai-logo.png.asset.json";

export const Route = createFileRoute("/")({
  component: Index,
});

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  streaming?: boolean;
  reveal?: number;
};

const uid = () => Math.random().toString(36).slice(2, 10);

function Index() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Message = { id: uid(), role: "user", content: text, createdAt: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await chatWithSolo({
        data: {
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        },
      });
      const reply = res.text || "…";
      const id = uid();
      setMessages((prev) => [
        ...prev,
        { id, role: "assistant", content: reply, createdAt: Date.now(), streaming: true, reveal: 0 },
      ]);
      // Typewriter reveal — fast, chunked
      // Typewriter reveal — very fast; finishes in ~500ms regardless of length
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
        else
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, streaming: false, reveal: total } : m)),
          );
      };
      requestAnimationFrame(tick);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content:
            "Sorry — I couldn't reach the model just now. Please try again in a moment.\n\n> " +
            (err instanceof Error ? err.message : String(err)),
          createdAt: Date.now(),
        },
      ]);
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
    <div className="grain relative flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="relative z-10 flex items-center justify-between border-b border-border/60 px-4 py-3 backdrop-blur-sm sm:px-6 sm:py-4">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white overflow-hidden glow-ring">
            <img src={logoAsset.url} alt="Muneem AI" className="h-full w-full object-contain invert" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight">Muneem AI</div>
            <div className="truncate text-[11px] text-muted-foreground">by Muneem Asif · UCP Lahore</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowAbout(true)}
            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground sm:px-3"
          >
            About
          </button>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 overflow-hidden">
        <section className="flex w-full flex-col">
          <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <Empty suggestions={suggestions} onPick={(s) => setInput(s)} />
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-5 px-3 py-5 sm:gap-6 sm:px-6 sm:py-8">
                {messages.map((m) => (
                  <MessageBubble key={m.id} m={m} />
                ))}
                {loading && <Typing />}
              </div>
            )}
          </div>

          <div className="border-t border-border/60 bg-background/70 px-3 py-3 backdrop-blur sm:px-4 sm:py-4">
            <div className="mx-auto max-w-3xl">
              <div className="group flex items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2 transition-all focus-within:border-primary/60 focus-within:glow-ring">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Ask anything — math, code, ideas…"
                  rows={1}
                  className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                  style={{ minHeight: 40 }}
                />
                <button
                  onClick={send}
                  disabled={loading || !input.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-1 px-1 text-[10px] text-muted-foreground sm:text-[11px]">
                <span>Muneem AI · minimal & fast</span>
                <span className="opacity-70 hidden sm:inline">Enter to send · Shift+Enter for newline</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
}

function Empty({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (s: string) => void;
}) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-5 text-center sm:px-6">
      <div className="fade-up mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white overflow-hidden glow-ring sm:mb-6">
        <img src={logoAsset.url} alt="Muneem AI" className="h-full w-full object-contain invert" />
      </div>
      <h1 className="fade-up text-2xl font-semibold tracking-tight sm:text-3xl" style={{ animationDelay: "60ms" }}>
        Ask Muneem AI anything.
      </h1>
      <p className="fade-up mt-2 max-w-md text-sm text-muted-foreground" style={{ animationDelay: "120ms" }}>
        A minimal, thoughtful AI. Math renders in LaTeX, code in clean blocks.
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
          {isUser ? "You" : <img src={logoAsset.url} alt="M" className="h-full w-full object-contain invert" />}
        </div>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:px-4 ${
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-card text-card-foreground border border-border/60"
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{display}</div>
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

function Typing() {
  return (
    <div className="fade-up flex items-center gap-3">
      <div className="mt-1 flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-white">
        <img src={logoAsset.url} alt="M" className="h-full w-full object-contain invert" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl border border-border/60 bg-card px-4 py-3">
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        <span className="typing-dot h-1.5 w-1.5 rounded-full bg-muted-foreground" />
      </div>
    </div>
  );
}

function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm fade-up p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white glow-ring">
            <img src={logoAsset.url} alt="Muneem AI" className="h-full w-full object-contain invert" />
          </div>
          <div>
            <div className="text-base font-semibold">Muneem AI</div>
            <div className="text-xs text-muted-foreground">A quiet, capable assistant.</div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Muneem AI is crafted by <span className="text-foreground font-medium">Muneem Asif</span>,
          a BSCS student at <span className="text-foreground font-medium">UCP Lahore</span>
          {" "}(University of Central Punjab). A warm, general-purpose chat companion with
          proper LaTeX math and clean code blocks — designed to feel calm, minimal, and fast.
        </p>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground transition hover:brightness-110"
        >
          Got it
        </button>
      </div>
    </div>
  );
}