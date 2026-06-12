// Wrapper around Chrome's built-in Prompt API (Gemini Nano).
// The persistent chat session object is not serializable: it lives here as a
// module singleton, never in Redux. Tool orchestration uses one-shot sessions
// (promptOneShot) so router/args calls never pollute the chat history.

const SYSTEM_PROMPT =
  "Tu es un assistant intégré à Bimboxa, une application de relevés et d'annotations de plans de construction. Réponds en français, de manière concise.";

let session = null;

export function isSupported() {
  return "LanguageModel" in self;
}

export async function getAvailability() {
  if (!isSupported()) return "unsupported";
  return await self.LanguageModel.availability();
}

export async function getSession({ onDownloadProgress } = {}) {
  if (session) return session;
  session = await self.LanguageModel.create({
    initialPrompts: [{ role: "system", content: SYSTEM_PROMPT }],
    monitor(m) {
      m.addEventListener("downloadprogress", (e) => {
        onDownloadProgress?.(e.loaded);
      });
    },
  });
  return session;
}

export async function promptStreaming(text, { onChunk } = {}) {
  const s = await getSession();
  const stream = s.promptStreaming(text);
  for await (const chunk of stream) {
    onChunk?.(chunk);
  }
}

export async function promptOneShot(
  text,
  { systemPrompt, responseConstraint }
) {
  const s = await self.LanguageModel.create({
    initialPrompts: systemPrompt
      ? [{ role: "system", content: systemPrompt }]
      : [],
  });
  try {
    const raw = await s.prompt(text, { responseConstraint });
    return JSON.parse(raw);
  } finally {
    s.destroy();
  }
}

export function resetSession() {
  session?.destroy();
  session = null;
}
