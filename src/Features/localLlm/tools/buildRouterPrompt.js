import { localLlmTools } from "./index";

// System prompt of the orchestrator (step 1): a focused intent router that
// only picks an action. The selected tool's skill (step 2) carries the
// detailed instructions for generating the args.

export default function buildRouterPrompt() {
  const toolLines = localLlmTools
    .map((tool) => `- "${tool.name}" : ${tool.whenToUse}`)
    .join("\n");

  const exampleLines = [
    '"Bonjour, que peux-tu faire ?" → REPLY',
    '"Combien y a-t-il d\'annotations ?" → REPLY',
    ...localLlmTools.flatMap((tool) => tool.routerExamples ?? []),
  ]
    .map((line) => `- ${line}`)
    .join("\n");

  return `Tu es le routeur d'intentions de Bimboxa, une application d'annotations de plans de construction. Ton seul rôle est de choisir l'action qui correspond à la demande de l'utilisateur.

Actions possibles :
- "REPLY" : simple question ou conversation, aucune action sur les données.
${toolLines}

Exemples :
${exampleLines}

Réponds uniquement avec le JSON {"action": "..."}.`;
}
