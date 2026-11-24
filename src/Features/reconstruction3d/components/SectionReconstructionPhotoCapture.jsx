import { useEffect, useRef, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setReconstructionPhotoTemplateId } from "../reconstruction3dSlice";
import { setToaster } from "Features/layout/layoutSlice";

import { Box, Button, MenuItem, Select, Tooltip } from "@mui/material";
import AddAPhotoOutlined from "@mui/icons-material/AddAPhotoOutlined";

import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useReconstructionPhotoTemplates from "../hooks/useReconstructionPhotoTemplates";
import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";
import getImageAnnotationSizeInBaseMapPx from "Features/imageAnnotations/utils/getImageAnnotationSizeInBaseMapPx";
import startDrawFromTemplate, {
  resolveActiveToolForTemplate,
} from "Features/mapEditor/utils/startDrawFromTemplate";
import pickReconstructionCameraTarget from "../services/pickReconstructionCameraTarget";
import {
  RECONSTRUCTION_FRAME_INTERCEPTOR_KEY,
  captureReconstructionFrameImage,
} from "../services/reconstructionFrameCapture";

// Heights under a millimetre are the plane itself.
const MIN_OFFSET_Z = 1e-3;

// ---------------------------------------------------------------------------
// SectionReconstructionPhotoCapture — one-line block of the reconstruction
// player: an annotation template selector (IMAGE templates of the scope) and
// « Ajouter une photo ».
// - 1st click: arms the draw of an IMAGE annotation with the chosen template
//   (the regular draw arming — the draft carries the RECONSTRUCTION_FRAME
//   commit interceptor, so a click on the 2D plan places the displayed
//   picture where clicked).
// - Armed: each click takes a screenshot of the player and adds the photo
//   where the camera of the displayed time / image looks (first visible
//   surface of the 3D scene, else the plane of the base map — see
//   pickReconstructionCameraTarget). The tool stays armed (Escape disarms).
// `getPose()`: camera of what the player displays (glTF frame), or null.
// ---------------------------------------------------------------------------
export default function SectionReconstructionPhotoCapture({
  baseMap,
  getPose,
}) {
  const dispatch = useDispatch();

  // strings

  const addS = "Ajouter une photo";
  const templateS = "Modèle d'annotation de la photo";
  const noTemplateS = "Aucun modèle « Image »";
  const noTemplateHelpS =
    "Créez un modèle d'annotation de forme « Image » dans une liste du module Dessin";
  const armS =
    "Armer l'ajout de photos avec ce modèle (un 2e clic prend la photo)";
  const shootS =
    "Capturer l'image affichée et l'ajouter là où regarde la caméra";
  const noScopeS = "Sélectionnez un Krto pour ajouter une photo.";
  const noPoseS = "Aucune caméra connue pour cette image : photo non placée.";
  const noTargetS = "Impossible de situer la caméra sur le fond de plan.";
  const noImageS = "Aucune image à capturer.";
  const addedS = "Photo ajoutée";
  const failedS = "Photo non ajoutée";

  // data

  const templates = useReconstructionPhotoTemplates();
  const storedTemplateId = useSelector(
    (s) => s.reconstruction3d.photoTemplateId ?? null
  );
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const activeLayerId = useSelector((s) => s.layers?.activeLayerId);
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const createAnnotation = useCreateAnnotation();

  // state

  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  // helpers

  const template =
    templates.find((t) => t.id === storedTemplateId) ?? templates[0] ?? null;
  const armed =
    Boolean(template) &&
    Boolean(enabledDrawingMode) &&
    newAnnotation?.annotationTemplateId === template.id &&
    newAnnotation?.commitInterceptor?.key ===
      RECONSTRUCTION_FRAME_INTERCEPTOR_KEY;
  const stop = (e) => e.stopPropagation();

  function toast(message, isError = false) {
    dispatch(setToaster({ message, isError }));
  }

  function arm(nextTemplate) {
    startDrawFromTemplate(dispatch, {
      template: nextTemplate,
      listingId: nextTemplate.listingId,
      activeTool: resolveActiveToolForTemplate(nextTemplate) ?? {
        key: "ONE_CLICK",
      },
      extraProps: {
        commitInterceptor: { key: RECONSTRUCTION_FRAME_INTERCEPTOR_KEY },
      },
    });
  }

  async function addPhoto() {
    const pose = getPose?.();
    if (!pose) return toast(noPoseS, true);
    const target = pickReconstructionCameraTarget({ baseMap, pose });
    const baseMapImageSize = baseMap.getImageSize?.() ?? null;
    if (!target || !(baseMapImageSize?.width > 0))
      return toast(noTargetS, true);

    const image = await captureReconstructionFrameImage();
    if (!image) return toast(noImageS, true);

    const draft = getNewAnnotationPropsFromAnnotationTemplate(template);
    const size = getImageAnnotationSizeInBaseMapPx({
      image,
      meterByPx: draft.meterByPx,
      baseMapMeterByPx: baseMap.getMeterByPx?.(),
      baseMapImageSize,
    });
    if (!size) return toast(noImageS, true);

    // The anchor (numbered badge) is what the camera looks at; the photo is
    // pinned on it by its top-left corner, like a photo placed in 2D.
    const created = await createAnnotation({
      ...draft,
      type: "IMAGE",
      image,
      baseMapId: baseMap.id,
      listingId: template.listingId,
      bbox: {
        x: target.point.x,
        y: target.point.y,
        width: size.width / baseMapImageSize.width,
        height: size.height / baseMapImageSize.height,
      },
      targetPoint: { ...target.point },
      ...(Math.abs(target.offsetZ) > MIN_OFFSET_Z
        ? { offsetZ: target.offsetZ }
        : {}),
      ...(activeLayerId ? { layerId: activeLayerId } : {}),
    });
    toast(created ? addedS : failedS, !created);
  }

  // effects

  // The remembered template left the scope: fall back on the displayed one.
  useEffect(() => {
    if (template && storedTemplateId && template.id !== storedTemplateId)
      dispatch(setReconstructionPhotoTemplateId(template.id));
  }, [template, storedTemplateId, dispatch]);

  // handlers

  function handleTemplateChange(e) {
    const next = templates.find((t) => t.id === e.target.value);
    if (!next) return;
    dispatch(setReconstructionPhotoTemplateId(next.id));
    // an armed draw follows the selector
    if (armed) arm(next);
  }

  async function handleAddClick() {
    if (!template || busyRef.current) return;
    if (!selectedScopeId) return toast(noScopeS, true);
    if (!armed) return arm(template);
    busyRef.current = true;
    setBusy(true);
    try {
      await addPhoto();
    } catch (error) {
      console.error("[reconstruction3d] photo capture failed", error);
      toast(`${failedS} : ${error?.message ?? error}`, true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  // render

  return (
    <Box
      onMouseDown={stop}
      sx={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1,
        minHeight: 40,
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Tooltip title={template ? templateS : noTemplateHelpS}>
        <Select
          size="small"
          variant="standard"
          disableUnderline
          displayEmpty
          disabled={templates.length === 0}
          value={template?.id ?? ""}
          onChange={handleTemplateChange}
          renderValue={() => template?.label || noTemplateS}
          inputProps={{ "aria-label": templateS }}
          sx={{ flex: 1, minWidth: 0, fontSize: 13 }}
        >
          {templates.map((t) => (
            <MenuItem key={t.id} value={t.id} dense>
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ fontSize: 13 }}>{t.label || "—"}</Box>
                {t.listingName && (
                  <Box sx={{ fontSize: 11, color: "text.secondary" }}>
                    {t.listingName}
                  </Box>
                )}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </Tooltip>
      <Tooltip title={!template ? noTemplateHelpS : armed ? shootS : armS}>
        <span>
          <Button
            size="small"
            variant={armed ? "contained" : "outlined"}
            disabled={!template || busy}
            startIcon={<AddAPhotoOutlined sx={{ fontSize: 16 }} />}
            onClick={handleAddClick}
            sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
          >
            {addS}
          </Button>
        </span>
      </Tooltip>
    </Box>
  );
}
