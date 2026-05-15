"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, Send, Loader2, X, ChevronDown, Bot, Sparkles } from "lucide-react";
import type { DisruptionEvent } from "@/lib/types";
import type { RerouteResult } from "../api/agent/reroute/route";
import type { Journey } from "./JourneyBuilder";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

interface LegForChat {
  id: string;
  fromName: string;
  toName: string;
  mode: string;
  distKm: number;
  durationHr: number;
}

interface Props {
  journey: Journey;
  disruptions: DisruptionEvent[];
  simulatedDisruptions: DisruptionEvent[];
  analyses: Array<{ legId: string; result: RerouteResult }>;
  legsMeta: LegForChat[];
}

const SUGGESTED_QUESTIONS = [
  "Which legs are most at risk?",
  "What's my total journey time?",
  "Should I reroute any legs?",
  "Summarise active disruptions",
  "What's the worst delay expected?",
];

export default function JourneyChatbot({ journey, disruptions, simulatedDisruptions, analyses, legsMeta }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  // Greet on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: `Hi! I'm your FLOWZEN AI co-pilot for **${journey.name}**. I can answer questions about your route, active disruptions, delay estimates, and rerouting options. What would you like to know?`,
        ts: Date.now(),
      }]);
    }
  }, [open, journey.name, messages.length]);

  const sendMessage = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = { role: "user", content: q, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          journey: { name: journey.name, legs: legsMeta },
          disruptions,
          analyses,
          simulatedDisruptions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setMessages(prev => [...prev, { role: "assistant", content: data.reply, ts: Date.now() }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `⚠ Error: ${err instanceof Error ? err.message : "Failed to contact AI"}`,
        ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const unread = !open && messages.filter(m => m.role === "assistant").length > 1;

  return (
    <>
      {/* ── Floating toggle button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 7, padding: "9px 14px",
          borderRadius: 10, border: "1px solid rgba(96,165,250,0.35)",
          background: open ? "rgba(96,165,250,0.18)" : "rgba(96,165,250,0.08)",
          color: "#93c5fd", cursor: "pointer", fontSize: 11, fontWeight: 600,
          transition: "all 0.2s", width: "100%", justifyContent: "center",
          boxShadow: open ? "0 0 16px rgba(96,165,250,0.2)" : "none",
        }}
        onMouseOver={e => { e.currentTarget.style.background = "rgba(96,165,250,0.18)"; e.currentTarget.style.borderColor = "rgba(96,165,250,0.5)"; }}
        onMouseOut={e => { if (!open) { e.currentTarget.style.background = "rgba(96,165,250,0.08)"; e.currentTarget.style.borderColor = "rgba(96,165,250,0.35)"; }}}
      >
        {open
          ? <><ChevronDown style={{ width: 12, height: 12 }} /> Hide AI Copilot</>
          : <><Sparkles style={{ width: 12, height: 12 }} /> Ask AI Copilot {unread && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#60a5fa", marginLeft: 2 }} />}</>
        }
      </button>

      {/* ── Chat panel ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            style={{ overflow: "hidden", marginTop: 10 }}
          >
            <div style={{
              border: "1px solid rgba(96,165,250,0.2)", borderRadius: 12,
              background: "rgba(5,5,18,0.95)", overflow: "hidden",
            }}>
              {/* Chat header */}
              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(96,165,250,0.06)",
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                  background: "linear-gradient(135deg,#3b82f6,#818cf8)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Bot style={{ width: 13, height: 13, color: "#fff" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#93c5fd" }}>FLOWZEN AI</div>
                  <div style={{ fontSize: 8, color: "#ffffff33", letterSpacing: 1 }}>Journey Copilot · Powered by Llama 3</div>
                </div>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80" }} />
                <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ffffff33" }}>
                  <X style={{ width: 12, height: 12 }} />
                </button>
              </div>

              {/* Messages */}
              <div ref={scrollRef} style={{ height: 260, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                <AnimatePresence initial={false}>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        display: "flex",
                        flexDirection: msg.role === "user" ? "row-reverse" : "row",
                        gap: 8, alignItems: "flex-start",
                      }}
                    >
                      {msg.role === "assistant" && (
                        <div style={{
                          width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
                          background: "linear-gradient(135deg,#3b82f6,#818cf8)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Bot style={{ width: 10, height: 10, color: "#fff" }} />
                        </div>
                      )}
                      <div style={{
                        maxWidth: "80%", padding: "8px 11px", borderRadius: 10,
                        background: msg.role === "user"
                          ? "rgba(96,165,250,0.18)"
                          : "rgba(255,255,255,0.04)",
                        border: msg.role === "user"
                          ? "1px solid rgba(96,165,250,0.3)"
                          : "1px solid rgba(255,255,255,0.07)",
                        fontSize: 11, color: "#e2e8f0", lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        borderTopRightRadius: msg.role === "user" ? 2 : 10,
                        borderTopLeftRadius: msg.role === "assistant" ? 2 : 10,
                      }}>
                        {msg.content}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {loading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      background: "linear-gradient(135deg,#3b82f6,#818cf8)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Bot style={{ width: 10, height: 10, color: "#fff" }} />
                    </div>
                    <div style={{
                      padding: "8px 12px", borderRadius: 10, borderTopLeftRadius: 2,
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                      display: "flex", gap: 4, alignItems: "center",
                    }}>
                      {[0, 1, 2].map(i => (
                        <motion.div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#60a5fa" }}
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }} />
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Suggested questions */}
              {messages.length <= 1 && (
                <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {SUGGESTED_QUESTIONS.map(q => (
                    <button key={q} onClick={() => sendMessage(q)}
                      style={{
                        padding: "4px 9px", borderRadius: 20, fontSize: 9, cursor: "pointer",
                        background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)",
                        color: "#93c5fd", transition: "all 0.15s",
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = "rgba(96,165,250,0.18)"; }}
                      onMouseOut={e => { e.currentTarget.style.background = "rgba(96,165,250,0.08)"; }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div style={{
                display: "flex", gap: 8, padding: "10px 12px", borderTop: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(0,0,0,0.2)",
              }}>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Ask about your journey…"
                  style={{
                    flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8, padding: "7px 10px", color: "#fff", fontSize: 11, outline: "none",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  style={{
                    width: 34, height: 34, borderRadius: 8, border: "none", cursor: !input.trim() || loading ? "not-allowed" : "pointer",
                    background: !input.trim() || loading ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,#3b82f6,#818cf8)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s",
                  }}
                >
                  {loading
                    ? <Loader2 style={{ width: 13, height: 13, color: "#fff", animation: "spin 1s linear infinite" }} />
                    : <Send style={{ width: 13, height: 13, color: "#fff" }} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
