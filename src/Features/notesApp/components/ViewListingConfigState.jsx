import { useEffect, useState } from "react";

import { Box, Button, Tooltip, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import HeaderListingConfigView from "./HeaderListingConfigView";
import RowToggleWithHint from "./RowToggleWithHint";

import {
  COLOR_OPTIONS,
  COLOR_LABELS,
  COLOR_HEX,
  getInitialStateId,
  getStates,
  removeState,
  setInitialState,
  updateState,
} from "../utils/notesAppStateModels";

// One state of a state model (mobile ConfigStateScreen): name, colour
// (5 Krnet tokens), initial flag, deletion (transitions pruned).
export default function ViewListingConfigState({
  listing,
  view,
  config,
  update,
  navigate,
  appName,
}) {
  // strings

  const captionS = `Configuration ${appName} · ${listing?.name ?? ""}`;
  const identityS = "Identité";
  const nameS = "Nom";
  const colorS = "Couleur";
  const initialS = "État initial";
  const initialHintS =
    "Un nouvel objet reçoit cet état. Désactivé : aucun état initial.";
  const deleteS = "Supprimer l'état";
  const deleteMessageS = "Les transitions associées seront retirées.";

  // data

  const { stateModelId, stateId } = view ?? {};
  const sm = config.stateModels.find((s) => s.id === stateModelId) ?? null;
  const state = sm
    ? (getStates(sm).find((s) => s.id === stateId) ?? null)
    : null;

  // state

  const [openDelete, setOpenDelete] = useState(false);

  // effects — vanished elsewhere: close

  useEffect(() => {
    if (!state) navigate.pop();
  }, [state]);

  if (!state) return null;

  // helpers

  const isInitial = getInitialStateId(sm) === stateId;

  // handlers

  const patchState = (patch) =>
    update.updateStateModel(stateModelId, (m) =>
      updateState(m, stateId, patch)
    );

  async function handleDelete() {
    await update.updateStateModel(stateModelId, (m) => removeState(m, stateId));
    setOpenDelete(false);
    navigate.pop();
  }

  // render

  return (
    <>
      <HeaderListingConfigView
        caption={captionS}
        title={state.name || "État"}
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
        <WhiteSectionTitle>{identityS}</WhiteSectionTitle>
        <FieldTextV2
          label={nameS}
          value={state.name ?? ""}
          onChange={(v) => v && patchState({ name: v })}
          options={{
            showAsSection: true,
            showLabel: false,
            fullWidth: true,
            changeOnBlur: true,
          }}
        />

        <WhiteSectionTitle sx={{ mt: 1 }}>{colorS}</WhiteSectionTitle>
        <WhiteSectionGeneric>
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
            {COLOR_OPTIONS.map((c) => (
              <Tooltip key={c} title={COLOR_LABELS[c]}>
                <Box
                  onClick={() => c !== state.color && patchState({ color: c })}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    bgcolor: COLOR_HEX[c],
                    cursor: "pointer",
                    outline: state.color === c ? "2px solid" : "none",
                    outlineColor: "text.primary",
                    outlineOffset: 2,
                  }}
                />
              </Tooltip>
            ))}
          </Box>
          <Typography
            variant="caption"
            sx={{ display: "block", color: "text.secondary", mt: 0.5 }}
          >
            {COLOR_LABELS[state.color] ?? state.color}
          </Typography>
        </WhiteSectionGeneric>

        <WhiteSectionTitle sx={{ mt: 1 }}>{initialS}</WhiteSectionTitle>
        <RowToggleWithHint
          label={initialS}
          hint={initialHintS}
          checked={isInitial}
          onChange={(v) =>
            update.updateStateModel(stateModelId, (m) =>
              setInitialState(m, stateId, v)
            )
          }
        />

        <Button
          size="small"
          color="error"
          variant="outlined"
          onClick={() => setOpenDelete(true)}
        >
          {deleteS}
        </Button>
      </Box>

      <DialogDeleteRessource
        open={openDelete}
        onClose={() => setOpenDelete(false)}
        onConfirmAsync={handleDelete}
        message={`Supprimer « ${state.name} » ? ${deleteMessageS}`}
      />
    </>
  );
}
