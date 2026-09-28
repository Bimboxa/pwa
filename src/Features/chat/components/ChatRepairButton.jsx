import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import PropTypes from "prop-types";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import getConcernedAnnotationIds from "Features/localizedRepair/utils/getConcernedAnnotationIds";
import {
  clearChatRepairZone,
  setEnabledDrawingMode,
} from "Features/mapEditor/mapEditorSlice";

// « Réparation » : the user draws a rectangle on the plan (CHAT_REPAIR mode,
// 2 clicks); the relay reruns a deterministic detection limited to that zone,
// taking the annotations of the selected listing that touch it as trusted
// bands (only their ends move), draws the missing pieces and calls the model
// only for what stays unresolved.
export default function ChatRepairButton({ send, disabled }) {
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const zone = useSelector((s) => s.mapEditor.chatRepairZone);
  const picking =
    useSelector((s) => s.mapEditor.enabledDrawingMode) === "CHAT_REPAIR";
  const mainBaseMap = useMainBaseMap();
  const { value: listing } = useSelectedListing();
  const annotations = useAnnotationsV2({
    caller: "ChatRepairButton",
    enabled: Boolean(open && mainBaseMap?.id && listing?.id),
    filterByMainBaseMap: true,
    filterBySelectedListing: true,
    filterBySelectedScope: true,
  });
  const meterByPx = mainBaseMap?.getMeterByPx?.() ?? null;
  const concerned = useMemo(
    () => (zone ? getConcernedAnnotationIds(annotations ?? [], zone).length : 0),
    [annotations, zone]
  );
  const calibrated = Number.isFinite(meterByPx) && meterByPx > 0;
  const size = zone && calibrated
    ? `${(zone.width * meterByPx).toFixed(2)} × ${(zone.height * meterByPx).toFixed(2)} m`
    : null;

  function pickZone() {
    dispatch(clearChatRepairZone());
    dispatch(setEnabledDrawingMode("CHAT_REPAIR"));
  }

  function close() {
    dispatch(clearChatRepairZone());
    if (picking) dispatch(setEnabledDrawingMode(null));
    setOpen(false);
  }

  function launch() {
    if (disabled || !zone || !calibrated) return;
    const round = (v) => Math.round(v * 1000) / 1000;
    const region = [
      round(zone.x),
      round(zone.y),
      round(zone.x + zone.width),
      round(zone.y + zone.height),
    ];
    const message = `Répare les raccords des annotations dans la zone sélectionnée du plan (${region.join(", ")} px de référence) : prolonge et raccorde les extrémités des murs existants, dessine les morceaux manquants, sans redessiner les annotations existantes.`;
    setOpen(false);
    dispatch(clearChatRepairZone());
    send(message, {
      autoDetect: {
        currentListing: true,
        autonomous: false,
        description: "",
        aiGeometry: false,
        parallelTools: false,
        repair: { region },
      },
    });
  }

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        color="inherit"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Réparation
      </Button>
      {open && (
        <Box
          role="region"
          aria-label="Réparation d’une zone"
          onDrop={(e) => e.stopPropagation()}
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 5,
            bgcolor: "background.default",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <Box
            sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}
          >
            <Button size="small" color="inherit" onClick={close}>
              Retour à la discussion
            </Button>
            <Typography variant="h6" sx={{ mt: 1 }}>
              Réparation d’une zone
            </Typography>
          </Box>
          <Stack spacing={2} sx={{ p: 2, flex: 1, overflowY: "auto" }}>
            <Typography variant="body2" color="text.secondary">
              Dessinez un rectangle sur le plan autour des raccords à reprendre.
              Les annotations de la liste courante qui touchent la zone sont
              considérées justes : seules leurs extrémités sont prolongées ou
              raccordées, à partir des tracés du plan, et les morceaux
              manquants sont dessinés. Le modèle n’intervient que s’il reste un
              raccord non résolu.
            </Typography>
            {!calibrated && (
              <Alert severity="warning">
                Calibrez le fond de plan avant de lancer une réparation.
              </Alert>
            )}
            {picking && (
              <Alert severity="info">
                Cliquez deux fois sur le plan pour définir la zone (Échap pour
                annuler).
              </Alert>
            )}
            {zone && !picking && (
              <Alert severity={concerned ? "success" : "warning"}>
                {`Zone : ${size ?? "?"} — ${concerned} annotation${concerned > 1 ? "s" : ""} concernée${concerned > 1 ? "s" : ""}.`}
                {!concerned &&
                  " Sans annotation dans la zone, seuls des tracés « À vérifier » pourront être ajoutés."}
              </Alert>
            )}
            <Box>
              <Button
                variant={zone ? "outlined" : "contained"}
                size="small"
                disabled={disabled || !calibrated || picking}
                onClick={pickZone}
              >
                {zone ? "Modifier la zone" : "Choisir la zone sur le plan"}
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Le PDF source du plan est utilisé pour cette réparation. Les
              déplacements d’extrémités et les nouveaux tracés apparaissent
              dans la discussion et restent annulables.
            </Typography>
          </Stack>
          <Box
            sx={{
              p: 1.5,
              display: "flex",
              justifyContent: "flex-end",
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            <Button
              variant="contained"
              disabled={disabled || !zone || picking || !calibrated}
              onClick={launch}
            >
              Lancer la réparation
            </Button>
          </Box>
        </Box>
      )}
    </>
  );
}

ChatRepairButton.propTypes = {
  send: PropTypes.func,
  disabled: PropTypes.bool,
};
