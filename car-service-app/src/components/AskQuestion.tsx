"use client";

import { useState } from "react";

type Source = { n: number; title: string; detail?: string; url?: string };
type SourceType = "documents" | "web" | "general";
type Message = {
  role: "user" | "assistant";
  text: string;
  sourceType?: SourceType;
  sources?: Source[];
};

const BADGE: Record<SourceType, string> = {
  documents: "From the driving-safety guides",
  web: "From the web",
  general: "General knowledge — no source found",
};

const EXAMPLES = [
  "How does alcohol affect my vision while driving?",
  "How should I set my mirrors to remove blind spots?",
  "What should I do when driving through a work zone?",
  "Which steering hand position is recommended?",
];

export default function AskQuestion() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(raw: string) {
    const question = raw.trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.answer,
          sourceType: data.refused ? undefined : data.sourceType,
          sources: Array.isArray(data.sources) ? data.sources : [],
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: err?.message || "Something went wrong reaching the assistant." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="ask" aria-labelledby="ask-title">
      <h2 id="ask-title">Ask about your car or driving</h2>
      <p className="s">
        Answers come from the driving-safety guides first, then the web. Each one shows its source.
      </p>

      <form
        className="askrow"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          type="text"
          className="askin"
          placeholder="e.g. How does alcohol affect my vision while driving?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          aria-label="Your question"
        />
        <button type="submit" className="btn" disabled={loading || !input.trim()}>
          Ask
        </button>
      </form>

      {messages.length === 0 && (
        <div className="chips">
          {EXAMPLES.map((q) => (
            <button type="button" key={q} className="chip" onClick={() => ask(q)} disabled={loading}>
              {q}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="chat-log" aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`chat-bubble ${m.role}`}>
              <div className="bubble-text">{m.text}</div>
              {m.role === "assistant" && m.sourceType && (
                <div className={`source-box ${m.sourceType}`}>
                  <div className="source-badge">{BADGE[m.sourceType]}</div>
                  {m.sources && m.sources.length > 0 && (
                    <ol className="source-list">
                      {m.sources.map((s) => (
                        <li key={s.n} value={s.n}>
                          {s.url ? (
                            <a href={s.url} target="_blank" rel="noopener noreferrer">
                              {s.title}
                            </a>
                          ) : (
                            s.title
                          )}
                          {s.detail ? <span className="muted-note"> — {s.detail}</span> : null}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
          ))}
          {loading && <div className="chat-bubble assistant spinner-text">Checking the guides…</div>}
        </div>
      )}
    </section>
  );
}
