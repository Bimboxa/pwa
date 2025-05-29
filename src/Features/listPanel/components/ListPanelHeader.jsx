import {useSelector} from "react-redux";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import {Box, Paper, Typography} from "@mui/material";
import ButtonCloseListPanel from "./ButtonCloseListPanel";

import IconButtonListingSelector from "Features/listings/components/IconButtonListingSelector";
import IconButtonMoreInHeader from "./IconButtonMoreInHeader";

export default function ListPanelHeader({open}) {
  // data

  const {value: selectedListing} = useSelectedListing();
  const deviceType = useSelector((s) => s.layout.deviceType);

  console.log("selectedListing", selectedListing);

  // helper

  const name = selectedListing?.name ?? "-?-";

  return (
    <Box sx={{p: 2, width: 1, display: "flex", alignItems: "center"}}>
      <Paper
        sx={{
          display: open ? "flex" : "none",
          alignItems: "center",
          justifyContent: "space-between",
          p: 1,
          flex: 1,
        }}
      >
        <IconButtonListingSelector />
        <Typography sx={{pl: 1}} variant="body2">
          {name}
        </Typography>
        <IconButtonMoreInHeader />
      </Paper>
      {deviceType !== "MOBILE" && open && <ButtonCloseListPanel />}
    </Box>
  );
}
