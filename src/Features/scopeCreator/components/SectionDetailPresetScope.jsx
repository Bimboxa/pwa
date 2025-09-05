import { useSelector } from "react-redux";

import usePresetScopes from "../hooks/usePresetScopes";

import { Box, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import BoxCenter from "Features/layout/components/BoxCenter";
import ImageGeneric from "Features/images/components/ImageGeneric";
import SectionDetailPresetScopeNoScope from "./SectionDetailPresetScopeNoScope";

export default function SectionDetailPresetScope() {
  // data

  const presetScopes = usePresetScopes();
  const presetScopeKey = useSelector(
    (s) => s.scopeCreator.selectedPresetScopeKey
  );

  // helper

  const presetScope = presetScopes.find((s) => s.key === presetScopeKey);

  if (!presetScopeKey) return <SectionDetailPresetScopeNoScope />;

  return (
    <BoxFlexVStretch sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography variant="h4">{presetScope?.name}</Typography>
          <Typography sx={{ pt: 1 }}>{presetScope?.description}</Typography>
        </Box>
      </Box>
      <BoxCenter sx={{ p: 8 }}>
        <Box
          sx={{
            border: (theme) => `1px solid ${theme.palette.divider}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "80%",
          }}
        >
          <ImageGeneric url={presetScope?.descriptionImageUrl} />
        </Box>
      </BoxCenter>
    </BoxFlexVStretch>
  );
}
