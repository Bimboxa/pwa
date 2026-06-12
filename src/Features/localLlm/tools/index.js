import createAnnotationsTool from "./createAnnotationsTool";
import updateAnnotationsTool from "./updateAnnotationsTool";

// Registry of the tools exposed to the local LLM. Native function calling is
// not available on the stable Prompt API, so tool calling is emulated with a
// two-step orchestration:
//   1. router call — picks an action (REPLY or a tool name), constrained to
//      a single enum field (see buildRouterPrompt.js);
//   2. args call — the selected tool's skill (skills/*.skill.md) instructs
//      the model, constrained to the tool's args schema.

export const localLlmTools = [createAnnotationsTool, updateAnnotationsTool];

export function getToolByAction(action) {
  return localLlmTools.find((tool) => tool.name === action) ?? null;
}

export function buildRouterConstraint() {
  return {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["REPLY", ...localLlmTools.map((tool) => tool.name)],
      },
    },
    required: ["action"],
  };
}

export function buildToolConstraint(tool) {
  return {
    type: "object",
    properties: {
      message: { type: "string" },
      [tool.argsKey]: tool.argsSchema,
    },
    required: ["message", tool.argsKey],
  };
}
