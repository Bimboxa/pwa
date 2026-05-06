import { useDispatch, useSelector } from "react-redux";

import { setCoupledNavigationEnabled } from "Features/layout/layoutSlice";

import { Box, Switch, Tooltip, Typography } from "@mui/material";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";

export default function SwitchCoupledNavigation() {
  // strings

  const tooltipS =
    "Navigation couplée : cet onglet suit l'autre. Navigation indépendante : cet onglet pilote l'autre.";
  const labelOnS = "Navigation couplée";
  const labelOffS = "Navigation indépendante";

  // data

  const enabled = useSelector((s) => s.layout?.coupledNavigationEnabled ?? true);

  // handlers

  const dispatch = useDispatch();

  function handleChange(_event, checked) {
    dispatch(setCoupledNavigationEnabled(checked));
  }

  // render

  return (
    <Tooltip title={tooltipS} placement="top">
      <Box sx={{ display: "flex", alignItems: "center", mr: 1 }}>
        {enabled ? (
          <LinkIcon fontSize="small" sx={{ color: "text.secondary" }} />
        ) : (
          <LinkOffIcon fontSize="small" sx={{ color: "text.disabled" }} />
        )}
        <Switch size="small" checked={enabled} onChange={handleChange} />
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", minWidth: 140, whiteSpace: "nowrap" }}
        >
          {enabled ? labelOnS : labelOffS}
        </Typography>
      </Box>
    </Tooltip>
  );
}
