import { NextResponse } from "next/server";

/**
 * Esta ruta corre solo en el servidor. Aquí se usan GROQ_API_KEY y GROQ_MODEL
 * (process.env / .env.local). El navegador llama a POST /api/chat sin Bearer;
 * el fetch a Groq y la clave no salen al cliente.
 */
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta GROQ_API_KEY en el servidor (.env.local)." },
      { status: 500 },
    );
  }

  let body: { messages: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json(
      { error: "messages debe ser un array no vacío." },
      { status: 400 },
    );
  }

  const started = performance.now();

  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: body.messages,
        temperature: 0.7,
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "No se pudo conectar con Groq. Revisa red o firewall." },
      { status: 502 },
    );
  }

  const elapsedMs = Math.round(performance.now() - started);

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return NextResponse.json(
      { error: "Respuesta no JSON de Groq." },
      { status: 502 },
    );
  }

  if (!res.ok) {
    const errMsg =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error?: { message?: string } }).error?.message ===
        "string"
        ? (data as { error: { message: string } }).error.message
        : `Groq respondió ${res.status}`;
    return NextResponse.json({ error: errMsg }, { status: res.status });
  }

  const d = data as {
    choices?: { message?: { content?: string } }[];
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
    model?: string;
  };

  const content = d.choices?.[0]?.message?.content ?? "";

  return NextResponse.json({
    content,
    model: d.model ?? model,
    usage: d.usage ?? null,
    responseTimeMs: elapsedMs,
  });
}
