import useToolGroupHotkey from "./useToolGroupHotkey";

// Global shortcut to START an opening (ouverture) draw:
//   - "o" → enter opening mode on the last-used CUT tool, falling back to the
//     first CUT tool (CUT_CLICK, surface clic-clic).
//
// Thin wrapper over the generic useToolGroupHotkey. Mounted once in the live map
// editor (MainMapEditorV3).
export default function useOpeningHotkey() {
  useToolGroupHotkey("o", "CUT");
}
