// Files a « Prompt IA » zip may carry. Pure module (no browser API): read by
// the attachment hook, the zip builder and the node tests.

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
// CAD / BIM sources the external model extracts annotations from.
const CAD_EXTENSIONS = ["dxf", "ifc", "ifczip"];
const DOCUMENT_EXTENSIONS = ["csv", "xlsx", "docx", "txt", "json"];

export const PROMPT_IA_ATTACHMENT_EXTENSIONS = [
  "pdf",
  ...IMAGE_EXTENSIONS,
  ...CAD_EXTENSIONS,
  ...DOCUMENT_EXTENSIONS,
];

// `accept` of the file picker.
export const PROMPT_IA_ATTACH_ACCEPT = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  ...[...CAD_EXTENSIONS, ...DOCUMENT_EXTENSIONS].map((ext) => `.${ext}`),
].join(",");

export function getFileExtension(name) {
  const text = String(name ?? "");
  const dot = text.lastIndexOf(".");
  return dot > 0 ? text.slice(dot + 1).toLowerCase() : "";
}

// PDF | IMAGE | DXF | IFC | OTHER: what `contexte.json` tells the model
// about an attachment (and what gets a CAD summary).
export function getPromptIaAttachmentKind(name) {
  const ext = getFileExtension(name);
  if (ext === "pdf") return "PDF";
  if (IMAGE_EXTENSIONS.includes(ext)) return "IMAGE";
  if (ext === "dxf") return "DXF";
  if (ext === "ifc" || ext === "ifczip") return "IFC";
  return "OTHER";
}

// → null when the file is accepted, else a French, user-facing reason.
export function getPromptIaAttachmentRejection(file) {
  const name = file?.name ?? "";
  const ext = getFileExtension(name);
  if (PROMPT_IA_ATTACHMENT_EXTENSIONS.includes(ext)) return null;
  // no usable extension: fall back on the MIME type
  if (
    file?.type === "application/pdf" ||
    /^image\/(png|jpeg|webp)$/.test(file?.type ?? "")
  )
    return null;
  if (ext === "dwg")
    return `« ${name} » : le format DWG n’est pas lisible par une IA, exportez le plan en DXF.`;
  return `« ${name} » : format non pris en charge (PDF, image, DXF, IFC, CSV, XLSX, DOCX, TXT, JSON).`;
}

// Text formats worth deflating in the zip (PDF / pictures are already
// compressed).
export function isCompressibleAttachment(name) {
  return !["pdf", ...IMAGE_EXTENSIONS, "ifczip", "xlsx", "docx"].includes(
    getFileExtension(name)
  );
}
