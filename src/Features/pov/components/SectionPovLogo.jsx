import { useSelector, useDispatch } from "react-redux";

import { setImageModeShowLogo } from "Features/mapEditor/mapEditorSlice";

import { Box, Typography } from "@mui/material";

import FieldCheck from "Features/form/components/FieldCheck";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import usePovLogoUrl from "../hooks/usePovLogoUrl";

const LABEL_SX = {
  fontWeight: 600,
  color: "text.secondary",
  lineHeight: 1.2,
};

// "Logo" block of the POV Cadrage tab: stamps the org logo bottom-right of
// the capture frame (ImageModeOverlay). Unlike its sibling sections it owns
// its WhiteSectionGeneric, so the whole block — not just its content —
// disappears when the org has no logo configured.
export default function SectionPovLogo() {
  const dispatch = useDispatch();

  // data

  const showLogo = useSelector((s) => s.mapEditor.imageModeShowLogo);
  const logoUrl = usePovLogoUrl();

  // handlers

  function handleToggle(checked) {
    dispatch(setImageModeShowLogo(Boolean(checked)));
  }

  // render

  if (!logoUrl) return null;

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="overline" sx={LABEL_SX}>
          Logo
        </Typography>

        <FieldCheck
          value={Boolean(showLogo)}
          onChange={handleToggle}
          label="Afficher le logo"
          options={{ type: "switch", showAsInline: true }}
        />

        {showLogo && (
          <Box
            component="img"
            src={logoUrl}
            alt=""
            sx={{
              alignSelf: "flex-end",
              maxWidth: 160,
              maxHeight: 48,
              objectFit: "contain",
            }}
          />
        )}
      </Box>
    </WhiteSectionGeneric>
  );
}
