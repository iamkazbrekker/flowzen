'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

interface Disruption {
  title: string;
  description?: string;
  severity?: string;
  location?: string;
  affected_modes?: string[];
  estimated_delay_days?: number;
}

interface Shipment {
  id: string;
  origin?: string;
  destination?: string;
  mode?: string;
  status?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface LlamaCopilotProps {
  disruption: Disruption | null;
  shipments: Shipment[];
}

const SUGGESTIONS = [
  'Which option protects my Q3 SLA?',
  'Compare CO₂ for all 3 routes',
  'What is the cheapest reroute?',
  'Summarise the risk in one sentence',
];

export function LlamaCopilot({ disruption, shipments }: LlamaCopilotProps) {
  const bottomRef  = useRef<HTMLDivElement>(null);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [inputValue, setInputValue]   = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [hasSentFirst, setHasSentFirst] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setIsLoading(true);
    setHasSentFirst(true);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
          shipments: shipments.slice(0, 10),
          disruption,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      // Stream the plain-text response
      const assistantId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantId ? { ...m, content: m.content + chunk } : m
            )
          );
        }
      }
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      const errMsg = err instanceof Error ? err.message : 'Request failed';
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: `⚠ ${errMsg}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, disruption, shipments]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text) return;
    setInputValue('');
    await sendMessage(text);
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-sm font-medium text-white">LLaMA Planner</span>
        <span className="ml-auto text-xs text-zinc-500">llama-3.3-70b · Groq</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
        {messages.length === 0 && (
          <p className="text-zinc-500 text-xs mt-2">
            Ask me anything about the active disruption and reroute options.
          </p>
        )}

        {messages.map(m => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-200'
              }`}
            >
              {m.content}
              {m.content === '' && isLoading && (
                <span className="flex gap-1 mt-1">
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </span>
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Suggestion chips */}
      {!hasSentFirst && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => sendMessage(s)}
              className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1 rounded-full transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 px-3 py-2.5 border-t border-zinc-800 bg-zinc-900"
      >
        <input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder="Ask the planner…"
          disabled={isLoading}
          className="flex-1 bg-zinc-800 text-zinc-100 text-xs placeholder-zinc-500 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs px-3 py-2 rounded-lg transition-colors"
        >
          Send
        </button>
      </form>

    </div>
  );
}