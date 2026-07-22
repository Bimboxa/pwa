const KEY = "povEnhancePrompts";

// User edits of the "Amélioration IA" prompt, kept per prompt id
// ({[promptId]: text}) so switching org / prompt keeps its own override.
// The org's appConfig prompt stays the default: an entry only exists while
// the user has customized it.

export function loadPovEnhancePromptsFromLocalStorage() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function storePovEnhancePromptsInLocalStorage(promptsById) {
  localStorage.setItem(KEY, JSON.stringify(promptsById ?? {}));
}
