import { Button, CircularProgress } from "@mui/material";
import { CloudSync } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function ButtonFetchMyKrtos({ onClick, loading, variant }) {
  // data

  const appConfig = useAppConfig();

  // strings

  const labelS = appConfig?.strings?.scope?.myScopes ?? "Mes Krtos";
  const loadLabelS = appConfig?.strings?.scope?.loadMyKrtos ?? "Charger mes Krtos";

  // render

  const isContained = variant === "contained";

  return (
    <Button
      size="small"
      variant={variant ?? "outlined"}
      color={isContained ? "secondary" : undefined}
      onClick={onClick}
      disabled={loading}
      startIcon={
        loading ? (
          <CircularProgress size={14} sx={{ color: "inherit" }} />
        ) : (
          <CloudSync sx={{ fontSize: "1rem" }} />
        )
      }
      sx={
        isContained
          ? undefined
          : {
              color: "text.secondary",
              borderColor: "divider",
              bgcolor: "white",
              px: 1.25,
              py: 0.4,
              "&:hover": { borderColor: "#c9c9d8", bgcolor: "white" },
            }
      }
    >
      {isContained ? loadLabelS : labelS}
    </Button>
  );
}
