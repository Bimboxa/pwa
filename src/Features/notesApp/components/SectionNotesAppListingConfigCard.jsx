import { useDispatch } from "react-redux";

import { pushListingConfigView } from "../notesAppSlice";

import { Box, IconButton, Typography } from "@mui/material";
import { CloudSync, ArrowForwardIos as Forward } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import useNotesAppConfig from "../hooks/useNotesAppConfig";
import useNotesAppListingConfig from "../hooks/useNotesAppListingConfig";

// Entry card of the Krnet configuration in the business-object listing
// panel: summary (fields, state models, codification) + link status; a
// click opens the CONFIG sub-view.
export default function SectionNotesAppListingConfigCard({ listing }) {
  const dispatch = useDispatch();

  // data

  const notesAppConfig = useNotesAppConfig();
  const appName = notesAppConfig?.name ?? "Krnet";
  const { summary, isLinked, isDirty } = useNotesAppListingConfig(listing);

  // strings

  const titleS = `Configuration ${appName}`;
  const notConfiguredS = "Non configurée";
  const linkedS = `Lié à ${appName}`;
  const dirtyS = "Modifications non envoyées";
  const notLinkedS = "Non lié";

  // helpers

  const { fieldsCount, stateModelsCount, autoCodeEnabled } = summary;
  const configured = fieldsCount > 0 || stateModelsCount > 0 || autoCodeEnabled;
  const summaryS = configured
    ? [
        `${fieldsCount} champ${fieldsCount > 1 ? "s" : ""}`,
        `${stateModelsCount} liste${stateModelsCount > 1 ? "s" : ""} d'état`,
        `codification ${autoCodeEnabled ? "active" : "inactive"}`,
      ].join(" · ")
    : notConfiguredS;
  const statusS = isDirty ? dirtyS : isLinked ? linkedS : notLinkedS;

  // handlers

  function handleOpen() {
    dispatch(
      pushListingConfigView({ listingId: listing.id, view: { key: "CONFIG" } })
    );
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          cursor: "pointer",
        }}
        onClick={handleOpen}
      >
        <CloudSync sx={{ fontSize: 18, color: "text.secondary" }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2">{titleS}</Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ display: "block" }}
          >
            {summaryS}
          </Typography>
          <Typography
            variant="caption"
            noWrap
            sx={{
              display: "block",
              color: isDirty ? "warning.main" : "text.secondary",
            }}
          >
            {statusS}
          </Typography>
        </Box>
        <IconButton size="small">
          <Forward sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>
    </WhiteSectionGeneric>
  );
}
