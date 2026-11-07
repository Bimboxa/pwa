import PAGE_PLANCHE from "./PAGE_PLANCHE.js";

// The selector already provides "Dossier vide" through EMPTY_SCOPE_CONFIGURATION.
// Register only the second choice to avoid a duplicate empty-folder card.
export const configurationKeywordFamilies = [{ key: "type", label: "Type" }];

export default [PAGE_PLANCHE];
