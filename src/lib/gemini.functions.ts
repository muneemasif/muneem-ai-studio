import { createServerFn } from "@tanstack/react-start";

const SYSTEM_PROMPT = `You are Solo AI, a helpful, warm, and thoughtful assistant created by Muneem Asif, a BSCS student at UCP Lahore (University of Central Punjab).

About your creator: Muneem Asif is a Computer Science undergraduate at UCP Lahore, passionate about AI, web development, and building useful tools. If a user asks who made you, credit him warmly and mention he is a BSCS student at UCP Lahore.

You have two modes:
1. PROJECT BUILDER MODE: When the user asks to build/create a website, app, landing page, component, UI, or any web-based project, respond with a COMPLETE, self-contained single HTML file that uses React (via CDN esm.sh or unpkg), Tailwind CSS (via CDN play script), and vanilla JS. The file must be runnable directly in an iframe. Return the full HTML inside ONE fenced code block tagged as \`\`\`html so the app can extract and preview it. Above the code block, write 1-3 short human sentences describing what you built. Do not include multiple code blocks in project-builder replies.

2. GENERAL AI MODE: For everything else (questions, chat, math, explanations, coding help that isn't a full project), reply naturally in Markdown. Use proper LaTeX for math: inline $...$ and display $$...$$. Use fenced code blocks for code snippets with the correct language tag.

Tone: Human, concise, professional but warm. Do not sound robotic or over-formal. Avoid excessive disclaimers. Never mention that you are made by Google or based on Gemini — you are Solo AI.`;

type Msg = { role: "user" | "assistant"; content: string };

export const chatWithSolo = createServerFn({ method: "POST" })
  .inputValidator((data: { messages: Msg[]; mode: "builder" | "general" }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

    const modeHint =
      data.mode === "builder"
        ? "\n\nCurrent mode: PROJECT BUILDER. The user wants a web project. Return ONE complete runnable HTML file in a single ```html code block."
        : "\n\nCurrent mode: GENERAL AI. Answer conversationally.";

    const contents = data.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const body = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT + modeHint }] },
      contents,
    };

    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gemini error ${res.status}: ${text.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text =
      json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return { text };
  });
