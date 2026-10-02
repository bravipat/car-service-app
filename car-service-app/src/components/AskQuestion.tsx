"use client";

import { useState } from "react";

type Message = { role: "user" | "assistant"; text: string };

export default function AskQuestion() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
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
      const answer = res.ok
        ? data.answer
        : data.error || "Something went wrong.";
      setMessages((prev) => [...prev, { role: "assistant", text: answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Something went wrong reaching the assistant." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2>Ask me a question</h2>
      <p className="muted-note" style={{ marginBottom: 12 }}>
        Automotive questions only — maintenance, repairs, symptoms, parts, and
        similar.
      </p>

      {messages.length > 0 && (
        <div className="chat-log">
          {messages.map((m, i) => (
            <div key={i} className={`chat-bubble ${m.role}`}>
              {m.text}
            </div>
          ))}
          {loading && (
            <div className="chat-bubble assistant spinner-text">Thinking…</div>
          )}
        </div>
      )}

      <form className="chat-input-row" onSubmit={handleAsk}>
        <input
          type="text"
          placeholder="e.g. Why is my brake pedal soft?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}
