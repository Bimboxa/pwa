import { useMemo, useState } from "react";

import { Box, IconButton, Menu, Tooltip } from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

import CommandMenuContext from "./CommandMenuContext";
import CommandSlot from "./CommandSlot";

// Split button of a UI group of the toolbar (constants/toolbarLayout.js) or
// of a command with variants (Ouverture…): the primary slot is the last-used
// command / the active variant, the arrow opens a menu listing every item as a
// MenuItem (CommandMenuContext). Lazy mount + keepMounted, like the former
// "Plus d'outils" menu: the items' hooks run only once the menu was opened,
// and a popup opened from an item survives the menu closing (anchored on the
// group root).
export default function CommandGroupButton({
  label,
  items,
  primaryItem,
  ctx,
  deps,
  onItemClick,
}) {
  // state

  const [rootEl, setRootEl] = useState(null);
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  // helpers

  const menuCtx = useMemo(
    () => ({
      variant: "menu",
      anchorEl: rootEl,
      closeMenu: () => setOpen(false),
      onItemClick,
    }),
    [rootEl, onItemClick]
  );

  // handlers

  function handleOpen() {
    setHasOpened(true);
    setOpen(true);
  }

  // render

  return (
    <Box
      ref={setRootEl}
      sx={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
    >
      <CommandSlot item={primaryItem} ctx={ctx} deps={deps} />
      <Tooltip title={label} enterDelay={400}>
        <IconButton
          size="small"
          onClick={handleOpen}
          sx={{
            p: 0,
            ml: "-6px",
            width: 14,
            height: 30,
            borderRadius: "4px",
            color: open ? "primary.main" : "text.disabled",
            "& .MuiSvgIcon-root": { fontSize: 16 },
          }}
        >
          <ArrowDropDownIcon />
        </IconButton>
      </Tooltip>
      <Menu
        open={open}
        anchorEl={rootEl}
        onClose={() => setOpen(false)}
        keepMounted
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { minWidth: 240, maxHeight: 480 } } }}
      >
        {hasOpened ? (
          <CommandMenuContext.Provider value={menuCtx}>
            {items.map((item) => (
              <CommandSlot key={item.key} item={item} ctx={ctx} deps={deps} />
            ))}
          </CommandMenuContext.Provider>
        ) : null}
      </Menu>
    </Box>
  );
}
