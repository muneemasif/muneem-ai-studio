import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { chatWithSolo } from "@/lib/gemini.functions";

export const Route = createFileRoute("/")({
  component: Index,
});

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

type Mode = "builder" | "general";

const uid = () => Math.random().toString(36).slice(2, 10);

function extractHtml(text: string): string | null {
  const m = text.match(/```html\s*([\s\S]*?)```/i);
  if (m) return m[1].trim();
  const m2 = text.match(/<!doctype[\s\S]*<\/html>/i) || text.match(/<html[\s\S]*<\/html>/i);
  return m2 ? m2[0] : null;
}

function stripHtmlBlock(text: string): string {
  return text.replace(/```html\s*[\s\S]*?```/i, "").trim();
}

function Index() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("general");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
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
          mode,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        },
      });
      const reply = res.text || "…";
      const html = mode === "builder" ? extractHtml(reply) : null;
      if (html) {
        setPreview(html);
        setPreviewOpen(true);
      }
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", content: reply, createdAt: Date.now() },
      ]);
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

  const suggestions = useMemo(
    () =>
      mode === "builder"
        ? [
            "A cozy coffee shop landing page with menu grid",
            "A pricing page with 3 tiered plans and a toggle",
            "A weather widget UI with animated icons",
          ]
        : [
            "Explain Fourier transforms with an example",
            "Solve step by step: integral of x·e^x dx",
            "What's a clean way to structure a React app?",
          ],
    [mode],
  );

  return (
    <div className="grain relative flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="relative z-10 flex items-center justify-between border-b border-border/60 px-6 py-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 glow-ring">
            <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Solo AI</div>
            <div className="text-[11px] text-muted-foreground">Project Builder · by Muneem Asif</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-card p-1">
            {(["general", "builder"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`relative rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  mode === m
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "general" ? "Chat" : "Build"}
              </button>
            ))}
          </div>
          {preview && (
            <button
              onClick={() => setPreviewOpen((v) => !v)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            >
              {previewOpen ? "Hide preview" : "Show preview"}
            </button>
          )}
          <button
            onClick={() => setShowAbout(true)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            About
          </button>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 overflow-hidden">
        <section
          className={`flex flex-col transition-all duration-500 ease-out ${
            previewOpen && preview ? "w-1/2 border-r border-border/60" : "w-full"
          }`}
        >
          <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <Empty mode={mode} suggestions={suggestions} onPick={(s) => setInput(s)} />
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
                {messages.map((m) => (
                  <MessageBubble key={m.id} m={m} />
                ))}
                {loading && <Typing />}
              </div>
            )}
          </div>

          <div className="border-t border-border/60 bg-background/70 px-4 py-4 backdrop-blur">
            <div className="mx-auto max-w-3xl">
              <div className="group flex items-end gap-2 rounded-2xl border border-border bg-card px-3 py-2 transition-all focus-within:border-primary/60 focus-within:glow-ring">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKey}
                  placeholder={
                    mode === "builder"
                      ? "Describe the web project you want to build…"
                      : "Ask anything — math, code, ideas…"
                  }
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
              <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
                <span>
                  {mode === "builder" ? "Build mode · React + Tailwind + JS" : "Chat mode · General purpose"}
                </span>
                <span className="opacity-70">Enter to send · Shift+Enter for newline</span>
              </div>
            </div>
          </div>
        </section>

        {previewOpen && preview && (
          <section className="flex w-1/2 flex-col bg-[oklch(0.11_0.01_250)] fade-up">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-destructive/70" />
                  <span className="h-3 w-3 rounded-full bg-primary/70" />
                  <span className="h-3 w-3 rounded-full bg-accent-foreground/40" />
                </div>
                <div className="ml-2 text-xs text-muted-foreground">Live Preview</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const blob = new Blob([preview], { type: "text/html" });
                    const url = URL.createObjectURL(blob);
                    window.open(url, "_blank");
                  }}
                  className="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
                >
                  Open ↗
                </button>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
                >
                  Close
                </button>
              </div>
            </div>
            <iframe
              key={preview.slice(0, 40) + preview.length}
              title="preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              srcDoc={preview}
              className="h-full w-full flex-1 bg-white"
            />
          </section>
        )}
      </div>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
}

function Empty({
  mode,
  suggestions,
  onPick,
}: {
  mode: Mode;
  suggestions: string[];
  onPick: (s: string) => void;
}) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-6 text-center">
      <div className="fade-up mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 glow-ring">
        <div className="h-3 w-3 rounded-full bg-primary" />
      </div>
      <h1 className="fade-up text-3xl font-semibold tracking-tight" style={{ animationDelay: "60ms" }}>
        {mode === "builder" ? "What should we build today?" : "Ask Solo anything."}
      </h1>
      <p className="fade-up mt-2 max-w-md text-sm text-muted-foreground" style={{ animationDelay: "120ms" }}>
        {mode === "builder"
          ? "Describe a UI, page or component. I'll craft it with React + Tailwind and render it live."
          : "A minimal, thoughtful AI. Math renders in LaTeX, code in clean blocks."}
      </p>
      <div className="fade-up mt-8 grid w-full gap-2 sm:grid-cols-3" style={{ animationDelay: "180ms" }}>
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
  const display = m.role === "assistant" ? stripHtmlBlock(m.content) || m.content : m.content;
  const hasBuild = m.role === "assistant" && /```html/i.test(m.content);
  return (
    <div className={`fade-up flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[85%] gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
        <div
          className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
            isUser ? "bg-accent text-accent-foreground" : "bg-primary/15 text-primary"
          }`}
        >
          {isUser ? "You" : "S"}
        </div>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
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
              {hasBuild && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] text-primary">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Rendered in preview
                </div>
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
      <div className="mt-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
        S
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm fade-up"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 glow-ring">
            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
          </div>
          <div>
            <div className="text-base font-semibold">Solo AI</div>
            <div className="text-xs text-muted-foreground">A quiet, capable assistant.</div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Solo AI is crafted by <span className="text-foreground font-medium">Muneem Asif</span>,
          a BSCS student at <span className="text-foreground font-medium">UCP Lahore</span>
          {" "}(University of Central Punjab). It has two sides: a{" "}
          <em className="text-foreground not-italic">Project Builder</em> that scaffolds live
          React + Tailwind pages, and a warm, general-purpose chat companion with proper LaTeX
          math and clean code blocks.
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