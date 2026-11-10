import { useDispatch, useSelector } from "react-redux";

import {
  setHeightCutDelta,
  setHeightCutOnCommit,
  setHeightCutSide,
} from "Features/mapEditor/mapEditorSlice";

import { Box, Paper, Switch, Typography } from "@mui/material";

import { isSurfaceCutDraft } from "Features/surfaceCut/utils/surfaceCutTools";

import FieldsHeightCutDelta from "./FieldsHeightCutDelta";

// Drawing panel option of the « Ouverture » and « Couper une surface »
// tools: « Ne pas découper » turns the drawn shape into a height cut — a face
// of the surface with an altitude delta — instead of a hole / a split.
// Null for every other tool.
export default function SectionHeightCutDrawingOptions() {
  const dispatch = useDispatch();

  // strings

  const switchS = "Ne pas découper (delta de hauteur)";
  const closedHelperS =
    "La forme dessinée délimite une face décalée en hauteur, sans trouer la surface.";
  const openHelperS =
    "Le trait délimite des faces sans scinder la surface. Sélectionnez ensuite une face pour saisir son delta de hauteur.";

  // data

  const isOpeningDraft = useSelector((s) => {
    const na = s.annotations.newAnnotation;
    return (
      Boolean(s.mapEditor.enabledDrawingMode) &&
      (na?.type === "CUT" || Boolean(na?.isOpening))
    );
  });
  const isSurfaceCut = useSelector(
    (s) =>
      Boolean(s.mapEditor.enabledDrawingMode) &&
      isSurfaceCutDraft(s.annotations.newAnnotation)
  );
  const enabled = useSelector((s) => Boolean(s.mapEditor.heightCutOnCommit));
  const delta = useSelector((s) => s.mapEditor.heightCutDelta);
  const side = useSelector((s) => s.mapEditor.heightCutSide);

  // render

  if (!isOpeningDraft && !isSurfaceCut) return null;

  return (
    <Paper
      elevation={0}
      sx={{
        px: 1,
        py: 0.5,
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {switchS}
        </Typography>
        <Switch
          size="small"
          checked={enabled}
          onChange={(e) => dispatch(setHeightCutOnCommit(e.target.checked))}
        />
      </Box>
      {enabled && (
        <>
          <Typography variant="caption" color="text.secondary">
            {isSurfaceCut ? openHelperS : closedHelperS}
          </Typography>
          {!isSurfaceCut && (
            <Box sx={{ py: 0.5 }}>
              <FieldsHeightCutDelta
                delta={delta}
                side={side}
                onDeltaChange={(value) => dispatch(setHeightCutDelta(value))}
                onSideChange={(value) => dispatch(setHeightCutSide(value))}
              />
            </Box>
          )}
        </>
      )}
    </Paper>
  );
}
