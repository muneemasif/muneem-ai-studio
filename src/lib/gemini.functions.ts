import { createServerFn } from "@tanstack/react-start";

const SYSTEM_PROMPT = `You are Aura AI, a helpful, warm, and thoughtful general-purpose assistant created by Muneem Asif, a BSCS student at UCP Lahore (University of Central Punjab).

About your creator: Muneem Asif is a Computer Science undergraduate at UCP Lahore, passionate about AI, web development, and building useful tools. If a user asks who made you, credit him warmly and mention he is a BSCS student at UCP Lahore.

Reply naturally in Markdown. Use proper LaTeX for math: inline $...$ and display $$...$$. Use fenced code blocks for code snippets with the correct language tag. Keep responses concise, tight, and human — no filler, no long preambles.

Tone: Human, concise, professional but warm. Do not sound robotic or over-formal. Avoid excessive disclaimers. Never mention that you are made by Google or based on Gemini — you are Aura AI.`;

type Msg = { role: "user" | "assistant"; content: string };

export const chatWithSolo = createServerFn({ method: "POST" })
  .inputValidator((data: { messages: Msg[] }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

    const contents = data.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const body = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    };

    // Fastest models first. Gemini flash-lite is the lowest-latency choice.
    const models = [
      "gemini-flash-lite-latest",
      "gemini-flash-latest",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
    ];

    let lastErr = "";
    let lastStatus = 0;
    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-goog-api-key": apiKey,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          },
        ).catch((e) => {
          lastErr = e instanceof Error ? e.message : String(e);
          return null;
        });
        clearTimeout(timeout);
        if (!res) continue;

        if (res.ok) {
          const json = (await res.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const text =
            json.candidates?.[0]?.content?.parts
              ?.map((p) => p.text ?? "")
              .join("") ?? "";
          return { text };
        }

        lastStatus = res.status;
        lastErr = (await res.text()).slice(0, 300);

        // Only retry/fallback on transient errors
        if (res.status !== 503 && res.status !== 429 && res.status !== 500) {
          throw new Error(`Gemini error ${res.status}: ${lastErr}`);
        }
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
    }

    return {
      text: "⚠️ Aura AI is temporarily overloaded. Please try again in a few seconds.",
      overloaded: true,
      status: lastStatus,
      detail: lastErr,
    };
  });
