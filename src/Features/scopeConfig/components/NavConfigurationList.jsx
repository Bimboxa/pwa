import { useSelector } from "react-redux";

import { LOCKED_MODULE_KEYS } from "Features/viewers/hooks/useViewers";

import {
  selectDisabledModuleKeys,
  selectDisabledToolKeys,
} from "../utils/scopeConfigSelectors";

import {
  Box,
  List,
  ListSubheader,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  Storage,
  Dashboard,
  Draw,
  ViewInAr,
  Satellite as SatelliteIcon,
} from "@mui/icons-material";

// Left summary column of the Configuration dialog. Sections top to bottom:
// Généralités, Modules, Outils (both hidden without a selected scope),
// Éditeurs. Per-scope disabled modules/tools render dimmed.
export default function NavConfigurationList({
  modules,
  tools,
  showScopeSections,
  selection,
  onSelect,
}) {
  // data

  const disabledModuleKeys = useSelector(selectDisabledModuleKeys);
  const disabledToolKeys = useSelector(selectDisabledToolKeys);

  // helpers

  const isSelected = (type, key) =>
    selection.type === type && selection.key === key;

  const editorItems = [
    { key: "EDITOR_2D", label: "Éditeur 2D", icon: <Draw fontSize="small" /> },
    {
      key: "EDITOR_3D",
      label: "Éditeur 3D",
      icon: <ViewInAr fontSize="small" />,
    },
    {
      key: "SATELLITE",
      label: "Carte satellite",
      icon: <SatelliteIcon fontSize="small" />,
    },
  ];

  // render

  return (
    <Box sx={{ width: 260, minWidth: 260, overflowY: "auto" }}>
      <List dense>
        <ListSubheader disableSticky>Généralités</ListSubheader>
        <ListItemButton
          selected={isSelected("GENERAL", "DATA_PREFS")}
          onClick={() => onSelect({ type: "GENERAL", key: "DATA_PREFS" })}
        >
          <ListItemIcon sx={{ minWidth: 36 }}>
            <Storage fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Données & préférences" />
        </ListItemButton>
        {showScopeSections && (
          <ListItemButton
            selected={isSelected("GENERAL", "MODULES_TOOLS")}
            onClick={() => onSelect({ type: "GENERAL", key: "MODULES_TOOLS" })}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Dashboard fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Modules & outils" />
          </ListItemButton>
        )}

        {showScopeSections && (
          <>
            <ListSubheader disableSticky>Modules</ListSubheader>
            {modules.map((m) => {
              const dimmed =
                !LOCKED_MODULE_KEYS.has(m.key) &&
                disabledModuleKeys.includes(m.key);
              return (
                <ListItemButton
                  key={m.key}
                  selected={isSelected("MODULE", m.key)}
                  onClick={() => onSelect({ type: "MODULE", key: m.key })}
                  sx={{ opacity: dimmed ? 0.45 : 1 }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>{m.icon}</ListItemIcon>
                  <ListItemText primary={m.label} />
                </ListItemButton>
              );
            })}

            <ListSubheader disableSticky>Outils</ListSubheader>
            {tools.map((t) => {
              const dimmed = disabledToolKeys.includes(t.key);
              return (
                <ListItemButton
                  key={t.key}
                  selected={isSelected("TOOL", t.key)}
                  onClick={() => onSelect({ type: "TOOL", key: t.key })}
                  sx={{ opacity: dimmed ? 0.45 : 1 }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>{t.icon}</ListItemIcon>
                  <ListItemText primary={t.label} />
                </ListItemButton>
              );
            })}
          </>
        )}

        <ListSubheader disableSticky>Éditeurs</ListSubheader>
        {editorItems.map((e) => (
          <ListItemButton
            key={e.key}
            selected={isSelected("EDITOR", e.key)}
            onClick={() => onSelect({ type: "EDITOR", key: e.key })}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>{e.icon}</ListItemIcon>
            <ListItemText primary={e.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
