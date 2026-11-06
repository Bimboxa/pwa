import { useMemo } from "react";

import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import {
  clearHiddenAnnotations,
  setShowHidden,
  unhideAnnotations,
  unhideMesh3dFace,
} from "Features/hiddenAnnotations/hiddenAnnotationsSlice";

import {
  Box,
  Button,
  Divider,
  IconButton,
  Popover,
  Tooltip,
  Typography,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";

import db from "App/db/db";

// Registry of « Masquer l'annotation » (Features/hiddenAnnotations), opened
// from the arrow of the command button: one row per hidden annotation / per
// hidden face of a mesh annotation (the eye shows it again), then
// « Afficher » / « Masquer » (show the hidden items without forgetting them,
// hide them again) and « Vider la liste ».
export default function PopoverHiddenAnnotations({ open, anchorEl, onClose }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Éléments masqués";
  const emptyS = "Aucun élément masqué";
  const shownS = "Affichés temporairement";
  const showS = "Afficher";
  const hideS = "Masquer";
  const clearS = "Vider la liste";
  const showOneS = "Réafficher";
  const faceS = "Face";
  const noTemplateS = "Sans modèle";

  // data

  const annotationIds = useSelector((s) => s.hiddenAnnotations.annotationIds);
  const facesByAnnotationId = useSelector(
    (s) => s.hiddenAnnotations.facesByAnnotationId
  );
  const showHidden = useSelector((s) => s.hiddenAnnotations.showHidden);

  const rowIds = useMemo(
    () => [...new Set([...annotationIds, ...Object.keys(facesByAnnotationId)])],
    [annotationIds, facesByAnnotationId]
  );
  const rowIdsKey = rowIds.join(",");
  const annotations = useLiveQuery(async () => {
    if (!open || !rowIds.length) return [];
    const rows = await db.annotations.bulkGet(rowIds);
    return rows.filter(Boolean);
  }, [open, rowIdsKey]);
  const templates = useAnnotationTemplates({ skip: !open });

  // helpers

  const annotationsById = useMemo(
    () => new Map((annotations ?? []).map((a) => [a.id, a])),
    [annotations]
  );
  const templatesById = useMemo(
    () => new Map((templates ?? []).map((t) => [t.id, t])),
    [templates]
  );

  // { key, annotationId, faceKey?, label, template }
  const rows = useMemo(() => {
    const describe = (annotationId) => {
      const annotation = annotationsById.get(annotationId);
      const template = templatesById.get(annotation?.annotationTemplateId);
      return {
        label:
          template?.label ??
          annotation?.templateLabel ??
          annotation?.label ??
          noTemplateS,
        template: template ?? annotation,
      };
    };
    const result = annotationIds.map((annotationId) => ({
      key: annotationId,
      annotationId,
      ...describe(annotationId),
    }));
    Object.entries(facesByAnnotationId).forEach(
      ([annotationId, signatures]) => {
        const { label, template } = describe(annotationId);
        signatures.forEach((signature, index) => {
          result.push({
            key: `${annotationId}::${signature.key}`,
            annotationId,
            faceKey: signature.key,
            label:
              signatures.length > 1
                ? `${faceS} ${index + 1} — ${label}`
                : `${faceS} — ${label}`,
            template,
          });
        });
      }
    );
    return result;
  }, [annotationIds, facesByAnnotationId, annotationsById, templatesById]);
  const count = rows.length;

  // handlers

  function handleShowOne(row) {
    if (row.faceKey) {
      dispatch(
        unhideMesh3dFace({ annotationId: row.annotationId, key: row.faceKey })
      );
    } else {
      dispatch(unhideAnnotations([row.annotationId]));
    }
  }

  // render

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      transformOrigin={{ vertical: "top", horizontal: "left" }}
      slotProps={{ paper: { sx: { width: 280 } } }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 1,
          px: 2,
          pt: 1.5,
          pb: 0.5,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {count > 0 ? `${titleS} (${count})` : titleS}
        </Typography>
        {showHidden && count > 0 && (
          <Typography variant="caption" color="secondary.main">
            {shownS}
          </Typography>
        )}
      </Box>

      {count === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ px: 2, py: 1.5, textAlign: "center" }}
        >
          {emptyS}
        </Typography>
      ) : (
        <Box sx={{ maxHeight: 280, overflowY: "auto", pb: 0.5 }}>
          {rows.map((row) => (
            <Box
              key={row.key}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                pl: 2,
                pr: 1,
                py: 0.25,
              }}
            >
              <AnnotationTemplateIcon template={row.template} size={16} />
              <Typography
                variant="body2"
                noWrap
                sx={{ flex: 1, minWidth: 0, fontSize: "0.8rem" }}
              >
                {row.label}
              </Typography>
              <Tooltip title={showOneS} enterDelay={400}>
                <IconButton size="small" onClick={() => handleShowOne(row)}>
                  <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      )}

      <Divider />
      <Box sx={{ display: "flex", gap: 0.5, p: 1 }}>
        <Button
          size="small"
          color="secondary"
          variant={showHidden ? "contained" : "outlined"}
          disabled={count === 0 || showHidden}
          onClick={() => dispatch(setShowHidden(true))}
          sx={{ flex: 1, minWidth: 0 }}
        >
          {showS}
        </Button>
        <Button
          size="small"
          color="secondary"
          variant="outlined"
          disabled={count === 0 || !showHidden}
          onClick={() => dispatch(setShowHidden(false))}
          sx={{ flex: 1, minWidth: 0 }}
        >
          {hideS}
        </Button>
        <Button
          size="small"
          color="inherit"
          disabled={count === 0}
          onClick={() => dispatch(clearHiddenAnnotations())}
          sx={{ flex: 1.4, minWidth: 0, whiteSpace: "nowrap" }}
        >
          {clearS}
        </Button>
      </Box>
    </Popover>
  );
}
