import { createContext, useContext } from "react";

// Rendering context of CommandButton. Null: the button renders as a Tooltip +
// IconButton (toolbar row). Provided by CommandGroupButton for the items of
// its menu ({ variant: "menu", anchorEl, closeMenu, onItemClick }): the same
// command renders as a MenuItem (icon + label), its popups are anchored on the
// group button (anchorEl — the MenuItem unmounts with the menu) and the click
// is reported so the group remembers its last-used command.
const CommandMenuContext = createContext(null);

export function useCommandMenu() {
  return useContext(CommandMenuContext);
}

export default CommandMenuContext;
