// Virtual entry of the "Dessin auto" band (SectionListingProcedures) for a
// listing whose Prompt IA is enabled (listing.promptIaEnabled): not an
// appConfig registry procedure, no source annotations, no outputs sweep — its
// play button opens DialogPromptIa.
export const PROMPT_IA_PROCEDURE_KEY = "PROMPT_IA";

export const PROMPT_IA_PROCEDURE = {
  key: PROMPT_IA_PROCEDURE_KEY,
  label: "Prompt IA",
  isPromptIa: true,
};

export const isPromptIaProcedure = (procedure) =>
  procedure?.key === PROMPT_IA_PROCEDURE_KEY;

// Same cap as the description field of the Prompt IA flow.
export const PROMPT_IA_INSTRUCTIONS_MAX_LENGTH = 4000;
