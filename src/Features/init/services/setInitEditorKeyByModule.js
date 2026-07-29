export default function setInitEditorKeyByModule(editorKeyByModule) {
  try {
    localStorage.setItem(
      "initEditorKeyByModule",
      JSON.stringify(editorKeyByModule)
    );
  } catch {
    // ignore quota / serialization errors
  }
}
