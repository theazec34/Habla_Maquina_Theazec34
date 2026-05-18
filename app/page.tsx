"use client";

import { useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";

type ChatMessage = { id: string; role: Role; content: string };

type Usage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

const STORAGE_KEY = "habla-maquina-session-v1";

type Session = {
  messages: ChatMessage[];
  totals: { prompt: number; completion: number; total: number };
  lastModel?: string;
  lastResponseTimeMs?: number;
  lastTokensPerSecond?: number;
};

const SYSTEM_PROMPT = "Eres un asistente útil y conciso.";
const defaultTotals = () =>
  ({ prompt: 0, completion: 0, total: 0 }) as Session["totals"];

function isRole(v: unknown): v is Role {
  return v === "user" || v === "assistant";
}

function parseMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    if (
      typeof o.id !== "string" ||
      typeof o.content !== "string" ||
      !isRole(o.role)
    ) {
      return null;
    }
    out.push({ id: o.id, role: o.role, content: o.content });
  }
  return out;
}

function parseTotals(raw: unknown): Session["totals"] | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const ok = (x: unknown) =>
    typeof x === "number" && Number.isFinite(x) && x >= 0;
  if (!ok(t.prompt) || !ok(t.completion) || !ok(t.total)) return null;
  return {
    prompt: t.prompt as number,
    completion: t.completion as number,
    total: t.total as number,
  };
}

function parseOptionalNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return undefined;
}

/** Devuelve null si el JSON no es una sesión válida (evita estado corrupto). */
function parseStoredSession(raw: string): Session | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const messages = parseMessages(o.messages);
  const totals = parseTotals(o.totals);
  if (!messages || !totals) return null;
  const lastModel =
    typeof o.lastModel === "string" ? o.lastModel : undefined;
  return {
    messages,
    totals,
    lastModel,
    lastResponseTimeMs: parseOptionalNumber(o.lastResponseTimeMs),
    lastTokensPerSecond: parseOptionalNumber(o.lastTokensPerSecond),
  };
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white/60 px-3 py-2 shadow-sm backdrop-blur-sm dark:border-zinc-700/80 dark:bg-zinc-800/50">
      <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
        {value}
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <div
      className="flex items-center gap-1.5 self-start rounded-2xl bg-white/90 px-4 py-3 shadow-md ring-1 ring-zinc-200/80 dark:bg-zinc-800/90 dark:ring-zinc-600/80"
      aria-live="polite"
      aria-busy
    >
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Pensando
      </span>
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-500 dark:bg-sky-400"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);

  const [totals, setTotals] = useState(defaultTotals);
  const [lastModel, setLastModel] = useState<string | undefined>();
  const [lastResponseTimeMs, setLastResponseTimeMs] = useState<
    number | undefined
  >();
  const [lastTokensPerSecond, setLastTokensPerSecond] = useState<
    number | undefined
  >();

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const session = parseStoredSession(raw);
        if (session) {
          setMessages(session.messages);
          setTotals(session.totals);
          setLastModel(session.lastModel);
          setLastResponseTimeMs(session.lastResponseTimeMs);
          setLastTokensPerSecond(session.lastTokensPerSecond);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      const session: Session = {
        messages,
        totals,
        lastModel,
        lastResponseTimeMs,
        lastTokensPerSecond,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      setStorageNotice(null);
    } catch {
      setStorageNotice(
        "No se pudo guardar el historial en este navegador (modo privado o sin espacio). La conversación sigue en pantalla hasta que recargues.",
      );
    }
  }, [
    storageReady,
    messages,
    totals,
    lastModel,
    lastResponseTimeMs,
    lastTokensPerSecond,
  ]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, isLoading]);

  async function send() {
    const text = input.trim();
    if (!text || isLoading) return;

    setError(null);
    setInput("");

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setIsLoading(true);

    const payloadMessages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages }),
      });

      let data: {
        error?: string;
        content?: string;
        usage?: Usage | null;
        model?: string;
        responseTimeMs?: number;
      };
      try {
        data = (await res.json()) as typeof data;
      } catch {
        throw new Error(
          "La respuesta del servidor no es JSON válido. Revisa la terminal del servidor.",
        );
      }

      if (!res.ok) {
        throw new Error(data.error ?? "Error al hablar con el modelo.");
      }

      const assistantText = data.content ?? "";
      setLastModel(data.model);
      setLastResponseTimeMs(data.responseTimeMs);

      const usage = data.usage;
      if (usage) {
        const p = usage.prompt_tokens ?? 0;
        const c = usage.completion_tokens ?? 0;
        const t = usage.total_tokens ?? p + c;

        setTotals((prev) => ({
          prompt: prev.prompt + p,
          completion: prev.completion + c,
          total: prev.total + t,
        }));

        const sec = (data.responseTimeMs ?? 0) / 1000;
        if (sec > 0 && typeof c === "number") {
          setLastTokensPerSecond(Number((c / sec).toFixed(2)));
        } else {
          setLastTokensPerSecond(undefined);
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantText,
        },
      ]);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Ocurrió un error inesperado.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setTotals(defaultTotals());
    setLastModel(undefined);
    setLastResponseTimeMs(undefined);
    setLastTokensPerSecond(undefined);
    setError(null);
    setStorageNotice(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="relative flex min-h-full flex-1 flex-col gap-4 bg-gradient-to-br from-sky-50 via-white to-violet-50 p-4 dark:from-zinc-950 dark:via-zinc-900 dark:to-slate-950 md:flex-row md:gap-6 md:p-8"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(14, 165, 233, 0.15), transparent), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(139, 92, 246, 0.12), transparent)",
      }}
    >
      <main className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <header className="flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-600 dark:text-sky-400">
              Groq · métricas en vivo
            </p>
            <h1 className="mt-1 bg-gradient-to-r from-zinc-900 to-zinc-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent dark:from-white dark:to-zinc-300">
              Habla con la máquina
            </h1>
            <p className="mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
              Historial y tokens guardados en tu dispositivo de forma segura.
            </p>
          </div>
          <button
            type="button"
            onClick={clearChat}
            className="shrink-0 rounded-xl border border-zinc-200/90 bg-white/80 px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm backdrop-blur transition hover:border-red-200 hover:bg-red-50 hover:text-red-800 dark:border-zinc-600 dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:border-red-900/50 dark:hover:bg-red-950/40 dark:hover:text-red-200"
          >
            Borrar conversación
          </button>
        </header>

        {storageNotice && (
          <div
            className="shrink-0 rounded-xl border border-amber-300/80 bg-amber-50/95 px-3 py-2 text-sm text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-100"
            role="status"
          >
            {storageNotice}
          </div>
        )}

        {error && (
          <div
            className="shrink-0 rounded-xl border border-red-300/80 bg-red-50/95 px-3 py-2.5 text-sm text-red-900 shadow-sm dark:border-red-800/60 dark:bg-red-950/50 dark:text-red-100"
            role="alert"
          >
            {error}
          </div>
        )}

        <div
          ref={listRef}
          className="flex min-h-[min(60vh,28rem)] flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-white/60 bg-white/50 p-4 shadow-lg shadow-zinc-200/50 ring-1 ring-zinc-200/60 backdrop-blur-md dark:border-zinc-700/50 dark:bg-zinc-900/40 dark:shadow-black/20 dark:ring-zinc-700/50 md:min-h-0"
        >
          {messages.length === 0 && !isLoading && (
            <div className="m-auto flex max-w-sm flex-col items-center gap-3 px-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 text-2xl shadow-lg">
                💬
              </div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Empieza una conversación
              </p>
              <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                Escribe abajo. Los datos de uso (tokens, tiempo) se actualizan
                tras cada respuesta. Si recargas la página, se restaura lo
                guardado si es válido.
              </p>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[min(100%,40rem)] rounded-2xl px-4 py-3 text-sm shadow-md transition ${
                m.role === "user"
                  ? "self-end bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-sky-500/25"
                  : "self-start border border-zinc-200/80 bg-white/95 text-zinc-900 shadow-zinc-200/30 dark:border-zinc-600/80 dark:bg-zinc-800/95 dark:text-zinc-100"
              }`}
            >
              <div
                className={`mb-1.5 text-[10px] font-bold uppercase tracking-wider ${
                  m.role === "user"
                    ? "text-sky-100"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {m.role === "user" ? "Tú" : "IA"}
              </div>
              <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
            </div>
          ))}
          {isLoading && <LoadingDots />}
        </div>

        <div className="flex shrink-0 gap-2">
          <input
            className="min-w-0 flex-1 rounded-xl border border-zinc-200/90 bg-white/90 px-4 py-3 text-sm text-zinc-900 shadow-inner placeholder:text-zinc-400 backdrop-blur focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800/90 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-sky-500"
            value={input}
            placeholder="Escribe un mensaje…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={isLoading}
            aria-label="Mensaje"
          />
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void send()}
            className="rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition hover:from-sky-500 hover:to-sky-400 disabled:opacity-50 dark:shadow-sky-900/30"
          >
            Enviar
          </button>
        </div>
      </main>

      <aside className="relative z-10 flex w-full shrink-0 flex-col gap-4 rounded-2xl border border-white/50 bg-white/55 p-5 shadow-xl shadow-zinc-300/30 ring-1 ring-zinc-200/60 backdrop-blur-md dark:border-zinc-700/50 dark:bg-zinc-900/55 dark:shadow-black/40 dark:ring-zinc-700/50 md:w-80">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
          Métricas de sesión
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Acumulado desde que abriste esta página (según respuestas de Groq).
        </p>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Prompt tokens" value={totals.prompt} />
          <StatCard label="Completion" value={totals.completion} />
          <StatCard label="Total tokens" value={totals.total} />
        </div>
        <div className="h-px bg-zinc-200/80 dark:bg-zinc-700/80" />
        <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Última respuesta
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800">
            <dt className="text-zinc-500 dark:text-zinc-400">Modelo</dt>
            <dd className="max-w-[55%] truncate text-right font-medium text-zinc-900 dark:text-zinc-100">
              {lastModel ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-zinc-100 pb-2 dark:border-zinc-800">
            <dt className="text-zinc-500 dark:text-zinc-400">Tiempo</dt>
            <dd className="font-mono tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
              {lastResponseTimeMs != null ? `${lastResponseTimeMs} ms` : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Tokens/s</dt>
            <dd className="font-mono tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
              {lastTokensPerSecond ?? "—"}
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
