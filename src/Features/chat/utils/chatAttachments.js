// PDFs a chat conversation may carry (the relay accepts as many per turn).
export const MAX_CHAT_PDFS = 4;

// Attachments the next turn sends: uploaded, with a relay pdfId.
export function readyAttachments(attachments) {
  return (attachments ?? []).filter((a) => a.status === "ready" && a.pdfId);
}

// `attachments` / `attachmentsInConversation` of a turn request, or {} when
// the conversation has no attachment (older relays refuse unknown fields).
export function buildTurnAttachments(attachments, attachmentsSent) {
  const ready = readyAttachments(attachments);
  if (!ready.length) return {};
  const ids = new Set(ready.map((a) => a.pdfId));
  const known = (attachmentsSent ?? []).filter((id) => ids.has(id));
  return {
    attachments: ready.map((a) => ({ pdfId: a.pdfId, name: a.name })),
    ...(known.length ? { attachmentsInConversation: known } : {}),
  };
}
