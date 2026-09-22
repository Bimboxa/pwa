// Device preference: Chat server connection (Configuration > Serveur Chat).
// Returns null (= org yaml defaults) when missing or malformed.
export default function getChatConnectionFromLocalStorage() {
  try {
    const value = JSON.parse(localStorage.getItem("chatConnection"));
    if (
      !["jwt", "PWA_KEY"].includes(value?.mode) ||
      typeof value?.baseUrl !== "string"
    )
      return null;
    return { mode: value.mode, baseUrl: value.baseUrl };
  } catch {
    return null;
  }
}
