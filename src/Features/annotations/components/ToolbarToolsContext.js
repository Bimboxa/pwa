import { createContext, useContext } from "react";

// Rendering context for the shared ToolbarToolButton. When null, a tool
// renders as a Tooltip + IconButton in the toolbar row. When provided by
// IconButtonMoreAnnotationTools ({ variant: "menu", anchorEl, closeMenu }),
// the same tool renders as a MenuItem (icon + label) and its popups are
// anchored on the "More" button.
const ToolbarToolsContext = createContext(null);

export function useToolbarTools() {
  return useContext(ToolbarToolsContext);
}

export default ToolbarToolsContext;
