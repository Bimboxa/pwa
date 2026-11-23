import { useMemo, useState } from "react";
import { useSelector } from "react-redux";

import {
  Box,
  InputBase,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  MenuItem,
  MenuList,
  Popover,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

import { COMMANDS_BY_KEY } from "../commands";
import { getToolbarSections } from "../constants/toolbarLayout";
import matchesCommandSearch, {
  getSearchWords,
} from "../utils/matchesCommandSearch";

// Module whose toolbar sections are listed: the displayed one, except the
// Infos module (its toolbar only creates infos) → the drawing commands.
function getPickerModuleKey(moduleKey) {
  return moduleKey === "COMMENTS" ? "MAP" : moduleKey;
}

// Picker of one toolbar command: the commands of the displayed module's
// toolbar, by section (the groups flattened), filtered by a search on the
// label. Opened above its anchor (the composer sits at the bottom of the info
// panel). `onChange(commandKey, command)`.
export default function MenuPickCommand({ open, anchorEl, onClose, onChange }) {
  // strings

  const searchS = "Rechercher une commande…";
  const emptyS = "Aucune commande ne correspond";

  // data

  const moduleKey = useSelector((s) => s.viewers.selectedViewerKey);

  // state

  const [search, setSearch] = useState("");

  // helpers

  const sections = useMemo(() => {
    const words = getSearchWords(search);
    return getToolbarSections(getPickerModuleKey(moduleKey))
      .map((section) => ({
        key: section.key,
        label: section.label,
        commands: section.entries
          .flatMap((entry) => {
            if (typeof entry === "string") return [entry];
            if (entry?.type === "group") return entry.commandKeys;
            return [];
          })
          .map((key) => COMMANDS_BY_KEY[key])
          .filter(
            (command) => command && matchesCommandSearch(command, null, words)
          ),
      }))
      .filter((section) => section.commands.length > 0);
  }, [moduleKey, search]);

  // handlers

  function handleClose() {
    setSearch("");
    onClose();
  }

  function handlePick(command) {
    setSearch("");
    onChange(command.key, command);
  }

  // render

  return (
    <Popover
      open={Boolean(open && anchorEl)}
      anchorEl={anchorEl}
      onClose={handleClose}
      anchorOrigin={{ vertical: "top", horizontal: "left" }}
      transformOrigin={{ vertical: "bottom", horizontal: "left" }}
      slotProps={{
        paper: {
          sx: {
            width: 300,
            maxHeight: 420,
            display: "flex",
            flexDirection: "column",
          },
        },
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          px: 1.5,
          py: 0.75,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <SearchIcon sx={{ fontSize: 18, color: "text.secondary" }} />
        <InputBase
          autoFocus
          fullWidth
          placeholder={searchS}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          // the letters must reach the field, not the list type-ahead
          onKeyDown={(e) => e.stopPropagation()}
          sx={{ fontSize: 13 }}
        />
      </Box>
      <MenuList dense sx={{ flex: 1, minHeight: 0, overflowY: "auto", py: 0 }}>
        {sections.length === 0 && (
          <Typography
            variant="body2"
            sx={{ px: 2, py: 1, color: "text.secondary" }}
          >
            {emptyS}
          </Typography>
        )}
        {sections.flatMap((section) => [
          <ListSubheader
            key={`section-${section.key}`}
            sx={{ lineHeight: "28px", fontSize: 11, bgcolor: "inherit" }}
          >
            {section.label}
          </ListSubheader>,
          ...section.commands.map((command) => {
            const Icon = command.Icon;
            return (
              <MenuItem
                key={`${section.key}:${command.key}`}
                dense
                onClick={() => handlePick(command)}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 32,
                    "& .MuiSvgIcon-root": { fontSize: 18 },
                  }}
                >
                  {Icon ? <Icon /> : command.icon}
                </ListItemIcon>
                <ListItemText
                  primary={command.label}
                  slotProps={{ primary: { variant: "body2" } }}
                />
              </MenuItem>
            );
          }),
        ])}
      </MenuList>
    </Popover>
  );
}
