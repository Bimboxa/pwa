import { useState } from "react";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import LibraryBooksIcon from "@mui/icons-material/LibraryBooks";
import LinkIcon from "@mui/icons-material/Link";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import CardListingSourceOption from "./CardListingSourceOption";
import DialogCreateListing from "./DialogCreateListing";
import DialogAddListingsFromScope from "./DialogAddListingsFromScope";

// Chooser shown before the create-listing dialogs: "Nouvelle liste" (empty
// list), "Depuis une bibliothèque" (pre-configured lists) or "Depuis un autre
// Krto" (link listings of another scope of the project — read-only here).
// Base map listings (isForBaseMaps) skip the chooser: linking only concerns
// the drawing (LOCATED_ENTITY) listings.
export default function DialogChooseListingSource({
  open,
  onClose,
  isForBaseMaps = false,
}) {
  // strings

  const appConfig = useAppConfig();
  const scopeS = appConfig?.strings?.scope?.nameSingular ?? "plan de repérage";

  const titleS = "Ajouter une liste";
  const emptyTitleS = "Nouvelle liste";
  const emptySubtitleS = "Une liste vide, à configurer.";
  const presetsTitleS = "Depuis une bibliothèque";
  const presetsSubtitleS = "Des listes pré-configurées de modèles.";
  const fromScopeTitleS = `Depuis un autre ${scopeS}`;
  const fromScopeSubtitleS = `Afficher ici les listes d'un autre ${scopeS} du projet (lecture seule).`;

  // state

  // "CHOOSE" | "EMPTY" | "PRESETS" | "FROM_SCOPE"
  const [step, setStep] = useState(isForBaseMaps ? "EMPTY" : "CHOOSE");

  // handlers

  function handleClose(...args) {
    onClose?.(...args);
  }

  // render

  if (step === "EMPTY" || step === "PRESETS") {
    return (
      <DialogCreateListing
        open={open}
        onClose={handleClose}
        isForBaseMaps={isForBaseMaps}
        mode={isForBaseMaps ? undefined : step}
      />
    );
  }

  if (step === "FROM_SCOPE") {
    return <DialogAddListingsFromScope open={open} onClose={handleClose} />;
  }

  return (
    <DialogGeneric open={open} onClose={handleClose} maxWidth={false}>
      <Box sx={{ p: 3, position: "relative" }}>
        <IconButton
          size="small"
          onClick={() => handleClose()}
          sx={{ position: "absolute", top: 12, right: 12 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
        <Typography variant="h6" sx={{ mb: 3 }}>
          {titleS}
        </Typography>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 3,
          }}
        >
          <CardListingSourceOption
            title={emptyTitleS}
            subtitle={emptySubtitleS}
            icon={AddIcon}
            onClick={() => setStep("EMPTY")}
          />
          <CardListingSourceOption
            title={presetsTitleS}
            subtitle={presetsSubtitleS}
            icon={LibraryBooksIcon}
            onClick={() => setStep("PRESETS")}
          />
          <CardListingSourceOption
            title={fromScopeTitleS}
            subtitle={fromScopeSubtitleS}
            icon={LinkIcon}
            onClick={() => setStep("FROM_SCOPE")}
          />
        </Box>
      </Box>
    </DialogGeneric>
  );
}
