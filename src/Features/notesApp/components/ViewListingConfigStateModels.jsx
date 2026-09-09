import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import { Add, ArrowForwardIos as Forward } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import HeaderListingConfigView from "./HeaderListingConfigView";

import {
  buildDefaultStateModel,
  getPrimaryStateModel,
  getStates,
} from "../utils/notesAppStateModels";

// State models ("listes d'état") of the listing: one row per model, a
// button creating the Krnet default model (À traiter / En cours / Résolu).
export default function ViewListingConfigStateModels({
  listing,
  config,
  update,
  navigate,
  appName,
}) {
  // strings

  const titleS = "Listes d'état";
  const captionS = `Configuration ${appName} · ${listing?.name ?? ""}`;
  const hintS =
    "Un suivi = une liste d'états (ex. À traiter / En cours / Résolu) affectable aux objets via un champ « État » de la fiche.";
  const emptyS = "Aucune liste d'état.";
  const createS = "Créer une liste d'état";
  const primaryS = "principale";
  const hiddenS = "masquée";

  // data

  const { stateModels } = config;
  const primary = getPrimaryStateModel(stateModels);

  // helpers

  function rowCaption(sm) {
    const n = getStates(sm).length;
    const parts = [`${n} état${n > 1 ? "s" : ""}`];
    if (primary?.id === sm.id) parts.push(primaryS);
    if (sm.visible === false) parts.push(hiddenS);
    return parts.join(" · ");
  }

  // handlers

  async function handleCreate() {
    const sm = buildDefaultStateModel();
    await update.updateStateModels((sms) => [...sms, sm]);
    navigate.push({ key: "STATE_MODEL", stateModelId: sm.id });
  }

  // render

  return (
    <>
      <HeaderListingConfigView
        caption={captionS}
        title={titleS}
        onBack={navigate.pop}
      />
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          p: 1.5,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {hintS}
        </Typography>
        <WhiteSectionGeneric>
          {stateModels.length === 0 ? (
            <Typography variant="caption" color="text.disabled">
              {emptyS}
            </Typography>
          ) : (
            <List dense disablePadding sx={{ mx: -1 }}>
              {stateModels.map((sm) => (
                <ListItemButton
                  key={sm.id}
                  onClick={() =>
                    navigate.push({ key: "STATE_MODEL", stateModelId: sm.id })
                  }
                  sx={{ py: 0.5 }}
                >
                  <ListItemText
                    primary={sm.name || "État"}
                    secondary={rowCaption(sm)}
                    slotProps={{
                      primary: { variant: "body2", noWrap: true },
                      secondary: { variant: "caption" },
                    }}
                  />
                  <Forward
                    sx={{ fontSize: 14, color: "text.secondary", ml: 1 }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </WhiteSectionGeneric>
        <Button
          size="small"
          variant="outlined"
          startIcon={<Add />}
          onClick={handleCreate}
        >
          {createS}
        </Button>
      </Box>
    </>
  );
}
