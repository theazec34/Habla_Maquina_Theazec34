# Habla con la máquina

Chat con **Groq** (API compatible con OpenAI), **Next.js 15** y panel de **tokens / rendimiento**. La clave de API solo se usa en el servidor (`app/api/chat/route.ts`); el navegador llama a `/api/chat` sin `Authorization`.

## Requisitos

- Node.js 18+
- Cuenta y API key en [Groq Console](https://console.groq.com/)

## Configuración

1. Copia `.env.example` a `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

   En Windows (PowerShell) puedes copiar el archivo manualmente y renombrarlo a `.env.local`.

2. Edita `.env.local` y pon tu clave:

   - `GROQ_API_KEY` — obligatorio
   - `GROQ_MODEL` — ID del modelo en Groq (el ejemplo usa `openai/gpt-oss-120b`; si el curso pide Llama 3, sustituye por el ID que muestre tu consola, por ejemplo un modelo `llama-3.x` disponible en tu cuenta)

3. Instala dependencias y arranca:

   ```bash
   npm install
   npm run dev
   ```

   Abre [http://localhost:3000](http://localhost:3000).

## Qué incluye el proyecto

- Interfaz de chat con historial (usuario / asistente) y estado de carga.
- Envío del **historial completo** en cada petición (API stateless).
- **Métricas de sesión**: tokens de prompt, de completado y total acumulados; último modelo, tiempo de respuesta y tokens/s aproximados (a partir de `usage` y el tiempo medido en el servidor).
- **Persistencia** en `localStorage` (sobrevive a recargar la página).
- Botón **Borrar conversación** (limpia estado y almacenamiento local).
- Manejo de errores con mensajes legibles.

## Estructura relevante

- `app/page.tsx` — UI del chat (cliente): `useState`, `useEffect`, `fetch` a `/api/chat`.
- `app/api/chat/route.ts` — `fetch` a `https://api.groq.com/openai/v1/chat/completions` con `Authorization: Bearer` y cuerpo JSON.

## Nota sobre la clave

No subas `.env.local` ni ningún archivo con tu clave real. Este repo incluye `.env.example` solo como plantilla vacía.

## Publicar en GitHub (repo `Habla-Maquina-Theazec34`)

1. Instala [GitHub CLI](https://cli.github.com/) y ejecuta una vez: `gh auth login`.
2. En PowerShell, desde la raíz del proyecto:

   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
   .\scripts\publish-github.ps1
   ```

El script crea `git` **solo en esta carpeta** (no mezcla con otros repos), hace commit en `main`, crea el repo público y hace push. Al final imprime la URL `https://github.com/TU_USUARIO/Habla-Maquina-Theazec34`.
