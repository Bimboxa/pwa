import { useSelector, useDispatch } from "react-redux";

import { setDisable3D } from "Features/appConfig/appConfigSlice";
import setDisable3DInLocalStorage from "Features/appConfig/services/setDisable3DInLocalStorage";

import { Box, List, Typography } from "@mui/material";
import ViewInAr from "@mui/icons-material/ViewInAr";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";

import RowConfig from "./RowItemConfig";

// "Éditeur 3D" section of the Modules & outils page: the sole entry point of
// the device-local disable3D preference (it used to be the "Désactiver la 3D"
// switch of Données & préférences, inverted wording — it belongs next to the
// modules it gates). The modules of the 3D family fall back to their 2D
// editor when it is off, and the "Éditeur 3D" page leaves the Configuration
// nav. Unlike the two sections above it is not per-scope: it follows the
// device, not the configuration.
export default function SectionThreedConfig({ onOpenSettings }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Éditeur 3D";
  const helperS = "Préférence de cet appareil, hors configuration.";
  const labelS = "Activer l'éditeur 3D";

  // data

  const disable3D = useSelector((s) => s.appConfig.disable3D);

  // helpers

  const enabled = !disable3D;

  // handlers

  function handleToggle() {
    const next = !disable3D;
    dispatch(setDisable3D(next));
    setDisable3DInLocalStorage(next);
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Box>
          <WhiteSectionTitle>{titleS}</WhiteSectionTitle>
          <Typography variant="caption" color="text.secondary">
            {helperS}
          </Typography>
        </Box>

        {/* same row as the two band sections (one click anywhere toggles),
            minus the handle: there is nothing to reorder here */}
        <List disablePadding>
          <RowConfig
            item={{
              key: "THREED",
              icon: <ViewInAr />,
              label: labelS,
              checked: enabled,
            }}
            onToggle={handleToggle}
            onOpenSettings={onOpenSettings}
          />
        </List>
      </Box>
    </WhiteSectionGeneric>
  );
}
