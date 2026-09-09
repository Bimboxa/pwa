import { useEffect, useState } from "react";

import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import { Add, ArrowForwardIos as Forward } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import HeaderListingConfigView from "./HeaderListingConfigView";
import RowToggleWithHint from "./RowToggleWithHint";

import {
  COLOR_HEX,
  buildNewState,
  getInitialStateId,
  getPrimaryStateModel,
  getStates,
  hasFreeTransitions,
  setFreeTransitions,
  setPrimary,
  tombstoneStateModel,
} from "../utils/notesAppStateModels";

// One state model (mobile ConfigStateModelScreen): name, navigation
// (listing_state_models visible + label), primary flag, states list and
// the allowed transitions (free / read-only rendering — Krnet has no
// transitions editor either).

function ColorDot({ color, size = 14 }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "50%",
        bgcolor: COLOR_HEX[color] ?? "grey.400",
        flexShrink: 0,
      }}
    />
  );
}

export default function ViewListingConfigStateModel({
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
  const namePlaceholderS = "Nom de la liste d'état…";
  const navS = "Navigation";
  const navVisibleS = "Afficher dans la navigation";
  const navVisibleHintS =
    "Affiche ce suivi dans la barre des listes concernées";
  const navNameS = "Nom dans la nav";
  const displayS = "Affichage";
  const primaryS = "Liste d'état principale";
  const primaryHintS = "Son état est affiché sur les objets dans les listes";
  const statesS = "États";
  const addStateS = "Ajouter un état…";
  const initialS = "INITIAL";
  const transitionsS = "Transitions autorisées";
  const freeTransitionsS = "Transition libre";
  const noTransitionS = "Aucune transition configurée.";
  const deleteS = "Supprimer la liste d'état";
  const deleteMessageS =
    "Cette action retire le suivi de toutes les listes concernées.";

  // data

  const stateModelId = view?.stateModelId;
  const sm = config.stateModels.find((s) => s.id === stateModelId) ?? null;
  const isPrimary =
    getPrimaryStateModel(config.stateModels)?.id === stateModelId;

  // state

  const [openDelete, setOpenDelete] = useState(false);

  // effects — deleted elsewhere: close

  useEffect(() => {
    if (!sm) navigate.pop();
  }, [sm]);

  if (!sm) return null;

  // helpers

  const states = getStates(sm);
  const initialStateId = getInitialStateId(sm);
  const freeTransitions = hasFreeTransitions(sm);
  const transitions = Array.isArray(sm.transitions) ? sm.transitions : [];
  const stateName = (id) => states.find((s) => s.id === id)?.name ?? id;

  // handlers

  const patchModel = (patch) =>
    update.updateStateModel(stateModelId, (m) => ({ ...m, ...patch }));

  async function handleAddState() {
    const state = buildNewState(states);
    await update.updateStateModel(stateModelId, (m) => ({
      ...m,
      states: [...getStates(m), state],
    }));
    navigate.push({ key: "STATE", stateModelId, stateId: state.id });
  }

  async function handleDelete() {
    if (sm.isLocalOnly) {
      await update.updateStateModels((sms) =>
        sms.filter((m) => m.id !== stateModelId)
      );
    } else {
      await update.updateStateModel(stateModelId, (m) =>
        tombstoneStateModel(m)
      );
    }
    setOpenDelete(false);
    navigate.pop();
  }

  // render

  return (
    <>
      <HeaderListingConfigView
        caption={captionS}
        title={sm.name || "État"}
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
          value={sm.name ?? ""}
          onChange={(v) => v && patchModel({ name: v })}
          options={{
            showAsSection: true,
            showLabel: false,
            fullWidth: true,
            changeOnBlur: true,
            placeholder: namePlaceholderS,
          }}
        />

        <WhiteSectionTitle sx={{ mt: 1 }}>{navS}</WhiteSectionTitle>
        <RowToggleWithHint
          label={navVisibleS}
          hint={navVisibleHintS}
          checked={sm.visible !== false}
          onChange={(v) => patchModel({ visible: v })}
        />
        <FieldTextV2
          label={navNameS}
          value={sm.navName ?? ""}
          onChange={(v) => patchModel({ navName: v })}
          options={{
            showAsSection: true,
            showLabel: false,
            fullWidth: true,
            changeOnBlur: true,
            placeholder: sm.name,
          }}
        />

        <WhiteSectionTitle sx={{ mt: 1 }}>{displayS}</WhiteSectionTitle>
        <RowToggleWithHint
          label={primaryS}
          hint={primaryHintS}
          checked={isPrimary}
          onChange={(v) =>
            update.updateStateModels((sms) => setPrimary(sms, stateModelId, v))
          }
        />

        <WhiteSectionTitle sx={{ mt: 1 }}>{statesS}</WhiteSectionTitle>
        <WhiteSectionGeneric>
          <List dense disablePadding sx={{ mx: -1 }}>
            {states.map((state) => (
              <ListItemButton
                key={state.id}
                onClick={() =>
                  navigate.push({
                    key: "STATE",
                    stateModelId,
                    stateId: state.id,
                  })
                }
                sx={{ py: 0.5, gap: 1 }}
              >
                <ColorDot color={state.color} />
                <ListItemText
                  primary={state.name || "Sans nom"}
                  slotProps={{ primary: { variant: "body2", noWrap: true } }}
                />
                {initialStateId === state.id && (
                  <Chip
                    label={initialS}
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1, height: 18, fontSize: 10 }}
                  />
                )}
                <Forward sx={{ fontSize: 14, color: "text.secondary" }} />
              </ListItemButton>
            ))}
            <ListItemButton onClick={handleAddState} sx={{ py: 0.5, gap: 1 }}>
              <Add fontSize="small" color="action" />
              <ListItemText
                primary={addStateS}
                slotProps={{
                  primary: { variant: "body2", color: "text.secondary" },
                }}
              />
            </ListItemButton>
          </List>
        </WhiteSectionGeneric>

        <WhiteSectionTitle sx={{ mt: 1 }}>{transitionsS}</WhiteSectionTitle>
        <WhiteSectionGeneric>
          <FormControlLabel
            sx={{ ml: 0 }}
            control={
              <Checkbox
                size="small"
                checked={freeTransitions}
                onChange={(e) =>
                  update.updateStateModel(stateModelId, (m) =>
                    setFreeTransitions(m, e.target.checked)
                  )
                }
              />
            }
            label={<Typography variant="body2">{freeTransitionsS}</Typography>}
          />
          {!freeTransitions && (
            <Box
              sx={{
                mt: 0.5,
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
              }}
            >
              {transitions.length === 0 ? (
                <Typography variant="caption" color="text.disabled">
                  {noTransitionS}
                </Typography>
              ) : (
                transitions.map((t) => (
                  <Box
                    key={t.fromState}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 0.5,
                    }}
                  >
                    <Typography variant="caption">
                      {stateName(t.fromState)} →
                    </Typography>
                    {(t.toState ?? []).map((id) => (
                      <Chip
                        key={id}
                        label={stateName(id)}
                        size="small"
                        variant="outlined"
                        sx={{ height: 18, fontSize: 10 }}
                      />
                    ))}
                  </Box>
                ))
              )}
            </Box>
          )}
        </WhiteSectionGeneric>

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
        message={`Supprimer « ${sm.name} » ? ${deleteMessageS}`}
      />
    </>
  );
}
