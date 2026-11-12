const MAX_AREA_TOKEN = "{{MAX_AREA}}";

// Text handed to the AI chat by « Ligne de coupe – prompt IA »: the static
// instructions (docs/threed/CUT_LINES_PROMPT*.md, given as a string so the
// builder stays node-testable) with the max surface filled in, then — in
// text mode — the context JSON in a fenced block. In GLB mode the context
// travels beside the instructions, as contexte.json in the zip.
//
// Pure, node-tested.
export default function buildCutLinesPromptMarkdown({
  instructions,
  context,
  embedContext = true,
}) {
  const body = String(instructions ?? "")
    .split(MAX_AREA_TOKEN)
    .join(String(context?.maxArea ?? ""))
    .trim();
  if (!embedContext) return `${body}\n`;
  return `${body}\n\n## Données\n\n\`\`\`json\n${JSON.stringify(context)}\n\`\`\`\n`;
}
