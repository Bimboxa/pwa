import { useDispatch } from "react-redux";

import { setSubSelection } from "Features/selection/selectionSlice";

import {
  Box,
  FormControlLabel,
  IconButton,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteOutline from "@mui/icons-material/DeleteOutline";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import FieldsHeightCutDelta from "./FieldsHeightCutDelta";
import { HEIGHT_FACE_PART_TYPE } from "../constants/heightCutConstants";
import removeHeightCutService from "../services/removeHeightCutService";
import toggleCutHeightCutService from "../services/toggleCutHeightCutService";
import updateHeightFaceService from "../services/updateHeightFaceService";

// Edit row of the sub-selected part of a POLYGON, for the three parts the
// height cuts deal with:
// - an opening (part.kind "CUT"): « Découper » ON — switching it off turns
//   the hole into a face with an altitude delta ;
// - a height face (part.kind "HEIGHT_FACE"): its delta, its side (top /
//   bottom, prisms only) and « Découper » OFF for the inside of a closed
//   shape — switching it on turns the face into a hole ;
// - an open trace (part.kind "HEIGHT_CUT"): delete only.
export default function ToolbarEditHeightCut({ annotation, part, accentColor }) {
  const dispatch = useDispatch();

  // strings

  const cutS = "Découper";
  const cutTooltipS =
    "Activé : la forme troue la surface. Désactivé : elle délimite une face décalée en hauteur.";
  const deleteS = "Supprimer";
  const resetS = "Remettre la face au niveau principal";

  // data

  const baseMap = useMainBaseMap();

  // helpers

  const isCut = part?.kind === "CUT";
  const isFace = part?.kind === "HEIGHT_FACE";
  const isTrace = part?.kind === "HEIGHT_CUT";
  const face = isFace ? part.face : null;
  const faces = annotation?.heightFaces ?? [];
  const hasPrismHeight = Number(annotation?.height) > 0;

  // A hole carved by a door / window opening (it carries the opening's id)
  // follows that opening: it cannot become a height face.
  const cut = isCut ? annotation?.cuts?.[part.cutIdx] : null;
  const isOpeningCut = Boolean(cut?.id);

  // The inside of a closed shape, whole: the face can go back to a hole.
  const isWholeRingFace =
    Boolean(face?.heightCutId) &&
    !face?.faceEntryId &&
    faces.filter((f) => f.heightCutId === face.heightCutId).length === 1;
  // A face holding values of its own (seed entry) can be reset; the inside
  // of a closed shape is removed with its shape.
  const canDeleteFace = isWholeRingFace || Boolean(face?.faceEntryId);

  const clearSubSelection = () =>
    dispatch(setSubSelection({ partId: null, partType: null }));

  // handlers

  async function handleFaceChange(patch) {
    const nextKey = await updateHeightFaceService({
      annotationId: annotation.id,
      face,
      faces,
      patch,
      imageSize: baseMap?.getImageSize?.(),
    });
    if (nextKey && nextKey !== face.key) {
      dispatch(
        setSubSelection({
          partId: `${annotation.id}::${HEIGHT_FACE_PART_TYPE}::${nextKey}`,
          partType: HEIGHT_FACE_PART_TYPE,
        })
      );
    }
  }

  async function handleCutSwitch(checked) {
    const done = checked
      ? await toggleCutHeightCutService({
          annotationId: annotation.id,
          heightCutId: face?.heightCutId,
        })
      : await toggleCutHeightCutService({
          annotationId: annotation.id,
          cutPointIds: (cut?.points ?? []).map((p) => p.id),
        });
    if (done) clearSubSelection();
  }

  async function handleDelete() {
    await removeHeightCutService({
      annotationId: annotation.id,
      heightCutId: isTrace
        ? part.heightCutId
        : isWholeRingFace
          ? face.heightCutId
          : null,
      faceEntryId: face?.faceEntryId ?? null,
    });
    clearSubSelection();
  }

  // render

  if (!annotation || annotation.type !== "POLYGON" || annotation.isMesh3d)
    return null;
  if (!isCut && !isFace && !isTrace) return null;

  const showCutSwitch = (isCut && !isOpeningCut) || isWholeRingFace;
  if (isCut && !showCutSwitch) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        px: 1.25,
        py: 0.5,
        gap: 1,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {part.captionFr}
      </Typography>
      {showCutSwitch && (
        <Tooltip title={cutTooltipS}>
          <FormControlLabel
            sx={{ m: 0, gap: 0.5 }}
            control={
              <Switch
                size="small"
                checked={isCut}
                onChange={(e) => handleCutSwitch(e.target.checked)}
              />
            }
            label={<Typography variant="caption">{cutS}</Typography>}
          />
        </Tooltip>
      )}
      {isFace && (
        <FieldsHeightCutDelta
          delta={face.delta}
          side={face.side}
          showSide={hasPrismHeight}
          onDeltaChange={(delta) => handleFaceChange({ delta })}
          onSideChange={(side) => handleFaceChange({ side })}
        />
      )}
      <Box sx={{ flex: 1 }} />
      {(isTrace || canDeleteFace) && (
        <Tooltip title={isFace && !isWholeRingFace ? resetS : deleteS}>
          <IconButton
            size="small"
            onClick={handleDelete}
            sx={{
              color: "text.disabled",
              "&:hover": {
                color: accentColor || "text.primary",
                bgcolor: (accentColor || "#000") + "18",
              },
            }}
          >
            <DeleteOutline fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
