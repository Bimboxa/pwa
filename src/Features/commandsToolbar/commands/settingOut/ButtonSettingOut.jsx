import { useState } from "react";
import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import useCreateSettingOutAnnotations from "Features/annotations/hooks/useCreateSettingOutAnnotations";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";

import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  InputBase,
  Popover,
  Typography,
} from "@mui/material";

import CommandButton from "../../components/CommandButton";
import ListPickAnnotationTemplate from "../../components/ListPickAnnotationTemplate";
import { getTargets } from "../../utils/selectionCommandState";
import { SETTING_OUT_TYPES } from "./settingOutCommand";

// Toolbar button of « Calepiner » (commandsToolbar): popover with the step,
// the options and the POINT template picker (scope templates only — the list
// is mounted while the popover is open).
export default function ButtonSettingOut({ command, ctx, state, hotkeyLabel }) {
  // data

  const dispatch = useDispatch();
  const createSettingOut = useCreateSettingOutAnnotations();
  const annotations = getTargets(ctx, SETTING_OUT_TYPES);

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stepM, setStepM] = useState("1");
  const [considerHeight, setConsiderHeight] = useState(true);
  const [considerAngle, setConsiderAngle] = useState(true);
  const [considerExtremities, setConsiderExtremities] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  // helpers

  const open = Boolean(anchorEl);

  // Source = POINT templates defined on the current scope only (same principle as
  // the "Dupliquer" selector: grouped by the scope's listings).
  const filterPointTemplate = (t, { listings }) =>
    resolveDrawingShape(t) === "POINT" &&
    (listings ?? []).some((l) => l.id === t.listingId);

  const canRun = Boolean(selectedTemplateId) && Number(stepM) > 0 && !loading;

  // handlers

  function handleOpen(event, anchor) {
    setAnchorEl(anchorEl ? null : anchor);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  async function handleRun() {
    if (!canRun) return;
    setLoading(true);
    try {
      const created = await createSettingOut({
        annotations,
        annotationTemplateId: selectedTemplateId,
        options: {
          stepM: Number(stepM),
          considerHeight,
          considerAngle,
          considerExtremities,
        },
      });
      if (!created?.length) {
        dispatch(setToaster({ message: "Aucun point généré", isError: true }));
      } else {
        dispatch(
          setToaster({
            message: `${created.length} point${created.length > 1 ? "s" : ""} de calepinage créé${created.length > 1 ? "s" : ""}`,
          })
        );
        handleClose();
      }
    } catch (e) {
      console.error("[settingOut]", e);
      dispatch(setToaster({ message: "Erreur de calepinage", isError: true }));
    } finally {
      setLoading(false);
    }
  }

  // render

  return (
    <>
      <CommandButton
        commandKey={command.key}
        label={command.label}
        Icon={command.Icon}
        hotkeyLabel={hotkeyLabel}
        state={{ ...state, active: open }}
        onClick={handleOpen}
      />

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { sx: { borderRadius: 2, mt: 0.5 } } }}
      >
        <Box
          onKeyDown={(e) => {
            if (e.key !== "Escape") e.stopPropagation();
          }}
          sx={{
            display: "flex",
            flexDirection: "column",
            px: 1.5,
            py: 1.5,
            width: 280,
            gap: 1,
          }}
        >
          {/* STEP (pill input, no number spinners) */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Pas
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                bgcolor: "action.hover",
                px: 1.5,
                py: 0.5,
                borderRadius: 1.5,
                minHeight: 32,
              }}
            >
              <InputBase
                value={stepM}
                onChange={(e) => setStepM(e.target.value.replace(",", "."))}
                inputProps={{ inputMode: "decimal" }}
                sx={{
                  width: 44,
                  fontSize: "0.875rem",
                  fontWeight: "bold",
                  "& input": { textAlign: "right", p: 0 },
                }}
              />
              <Typography
                variant="caption"
                sx={{ ml: 0.5, fontWeight: "bold", color: "text.secondary" }}
              >
                m
              </Typography>
            </Box>
          </Box>

          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={considerHeight}
                onChange={(e) => setConsiderHeight(e.target.checked)}
              />
            }
            label="Changements de hauteur"
            slotProps={{ typography: { variant: "body2" } }}
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={considerAngle}
                onChange={(e) => setConsiderAngle(e.target.checked)}
              />
            }
            label="Ruptures d'angle"
            slotProps={{ typography: { variant: "body2" } }}
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={considerExtremities}
                onChange={(e) => setConsiderExtremities(e.target.checked)}
              />
            }
            label="Aux extrémités"
            slotProps={{ typography: { variant: "body2" } }}
          />

          <Divider />

          <Box sx={{ height: 260, display: "flex", flexDirection: "column" }}>
            {open && (
              <ListPickAnnotationTemplate
                selectedAnnotationTemplateId={selectedTemplateId}
                onChange={setSelectedTemplateId}
                filterTemplate={filterPointTemplate}
                emptyText="Aucun modèle de point dans ce plan de repérage"
              />
            )}
          </Box>

          <Button
            size="small"
            variant="contained"
            disabled={!canRun}
            onClick={handleRun}
            sx={{ mt: 0.5, textTransform: "none" }}
          >
            {loading ? (
              <CircularProgress size={18} thickness={5} />
            ) : (
              "Calepiner"
            )}
          </Button>
        </Box>
      </Popover>
    </>
  );
}
