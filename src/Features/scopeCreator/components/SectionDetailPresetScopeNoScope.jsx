import { useSelector } from "react-redux";

import usePresetScopes from "../hooks/usePresetScopes";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, Typography } from "@mui/material";

import BoxCenter from "Features/layout/components/BoxCenter";
import ImageGeneric from "Features/images/components/ImageGeneric";
import ButtonCreateScope from "./ButtonCreateScope";

export default function SectionDetailPresetScopeNoScope() {
  // string

  const descriptionS = "Créez une krto à partir d'un modèle";

  // data

  const appConfig = useAppConfig();

  // helper

  const imageUrl = appConfig?.features.presetScopes?.templatesImageUrl;

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <BoxCenter sx={{ p: 3 }}>
          <Typography variant="h4">{descriptionS}</Typography>
        </BoxCenter>
      </Box>
      <BoxCenter sx={{ p: 8 }}>
        <Box
          sx={{
            border: (theme) => `1px solid ${theme.palette.divider}`,
            width: "80%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ImageGeneric url={imageUrl} />
        </Box>
      </BoxCenter>
    </Box>
  );
}
