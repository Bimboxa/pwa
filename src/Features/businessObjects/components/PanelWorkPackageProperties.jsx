import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import {
  setLinkingWorkPackageId,
  triggerRelsWorkPackageAnnotationUpdate,
} from "../businessObjectsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import { AddLink, ArrowBack as Back, LinkOff } from "@mui/icons-material";

import { CirclePicker } from "react-color";
import defaultColors from "Features/colors/data/defaultColors";

import db from "App/db/db";

import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useRelsWorkPackageAnnotation from "../hooks/useRelsWorkPackageAnnotation";
import useUpdateWorkPackage from "../hooks/useUpdateWorkPackage";
import useWorkPackageHours from "../hooks/useWorkPackageHours";
import usePlanningConsumedHours from "Features/planning/hooks/usePlanningConsumedHours";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import DialogDeleteWorkPackage from "./DialogDeleteWorkPackage";
import SectionWorkPackageTasksPicker from "./SectionWorkPackageTasksPicker";

import getAnnotationMainQtyLabel from "Features/annotations/utils/getAnnotationMainQtyLabel";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import formatBusinessObjectNumber from "../utils/formatBusinessObjectNumber";
import { getBusinessObjectUnitLabel } from "../utils/getBusinessObjectQtyLabel";
import { formatHours } from "../utils/hoursRatioConversions";

function SectionBand({ label, value }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 1.5,
        py: 0.75,
        bgcolor: "panel.sectionBg",
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      {value != null && (
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {value}
        </Typography>
      )}
    </Box>
  );
}

// Right-panel properties of the work package soloed in the PLANNING drawer:
// label / colour, picking-mode toggle, budget vs consumed, the DERIVED tasks
// with their detail (qty × ratio), the linked annotations (select / unlink),
// delete.
export default function PanelWorkPackageProperties() {
  const dispatch = useDispatch();

  const workPackageId = useSelector(
    (s) => s.businessObjects.selectedWorkPackageId
  );
  const workPackagesUpdatedAt = useSelector(
    (s) => s.businessObjects.workPackagesUpdatedAt
  );
  const linkingWorkPackageId = useSelector(
    (s) => s.businessObjects.linkingWorkPackageId
  );
  const workPackage = useLiveQuery(async () => {
    if (!workPackageId) return null;
    const w = await db.workPackages.get(workPackageId);
    return w && !w.deletedAt ? w : null;
  }, [workPackageId, workPackagesUpdatedAt]);
  const listingId = workPackage?.listingId ?? null;

  const updateWorkPackage = useUpdateWorkPackage();
  const { value: rels } = useRelsWorkPackageAnnotation({ workPackageId });
  const {
    annotationsByWorkPackageId,
    tasksByWorkPackageId,
    budgetByWorkPackageId,
  } = useWorkPackageHours({ listingId });
  const { consumedByWorkPackageId } = usePlanningConsumedHours({ listingId });
  const annotationTemplates = useAnnotationTemplates();
  const spriteImage = useAnnotationSpriteImage();
  const { value: baseMaps } = useBaseMaps();

  const [label, setLabel] = useState("");
  const [openDelete, setOpenDelete] = useState(false);
  useEffect(() => {
    setLabel(workPackage?.label ?? "");
  }, [workPackage?.id, workPackage?.label]);

  // helpers

  const annotations = annotationsByWorkPackageId[workPackageId] ?? [];
  const tasks = tasksByWorkPackageId[workPackageId] ?? [];
  const budget = budgetByWorkPackageId[workPackageId] ?? null;
  const consumed = consumedByWorkPackageId[workPackageId] ?? 0;
  const isLinking = linkingWorkPackageId === workPackageId;
  const relByAnnotationId = useMemo(
    () => getItemsByKey(rels, "annotationId"),
    [rels]
  );
  const templateById = useMemo(
    () => getItemsByKey(annotationTemplates ?? [], "id"),
    [annotationTemplates]
  );
  const baseMapNameById = useMemo(() => {
    const byId = {};
    (baseMaps ?? []).forEach((bm) => {
      byId[bm.id] = bm.name;
    });
    return byId;
  }, [baseMaps]);

  // handlers

  function handleBack() {
    dispatch(setSelectedItem({ id: listingId, type: "LISTING" }));
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  function handleLabelBlur() {
    if (!workPackage || !label || label === workPackage.label) return;
    updateWorkPackage(workPackage.id, { label });
  }

  function handleColorChange(c) {
    if (!workPackage || c.hex === workPackage.color) return;
    updateWorkPackage(workPackage.id, { color: c.hex });
  }

  function handleWorkStationIdsChange(workStationIds) {
    if (!workPackage) return;
    updateWorkPackage(workPackage.id, { workStationIds });
  }

  function handleToggleLinking() {
    dispatch(setLinkingWorkPackageId(isLinking ? null : workPackageId));
  }

  function handleSelectAnnotation(annotation) {
    if (annotation.baseMapId)
      dispatch(setSelectedMainBaseMapId(annotation.baseMapId));
    dispatch(
      setSelectedItem({
        id: annotation.id,
        nodeId: annotation.id,
        type: "NODE",
        nodeType: "ANNOTATION",
        listingId: annotation.listingId,
      })
    );
  }

  async function handleUnlink(annotation) {
    const rel = relByAnnotationId[annotation.id];
    if (!rel) return;
    await db.relsWorkPackageAnnotation.delete(rel.id);
    dispatch(triggerRelsWorkPackageAnnotationUpdate());
  }

  // render

  if (!workPackage) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          p: 1,
          pl: 0.5,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <IconButton onClick={handleBack} title="Propriétés de la liste">
          <Back />
        </IconButton>
        <Box
          sx={{
            width: 14,
            height: 14,
            minWidth: 14,
            borderRadius: "2px",
            bgcolor: workPackage.color,
          }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">
            Tâche
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }} noWrap>
            {workPackage.label}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ overflowY: "auto", flex: 1 }}>
        <Box
          sx={{
            p: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <TextField
            fullWidth
            size="small"
            label="Nom"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleLabelBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.target.blur();
            }}
          />
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <CirclePicker
              onChange={handleColorChange}
              color={workPackage.color}
              colors={defaultColors}
              circleSize={16}
              circleSpacing={9}
            />
          </Box>
        </Box>

        <Box sx={{ p: 1, borderBottom: "1px solid", borderColor: "divider" }}>
          <Button
            size="small"
            variant={isLinking ? "contained" : "outlined"}
            fullWidth
            onClick={handleToggleLinking}
            startIcon={<AddLink fontSize="small" />}
          >
            {isLinking ? "Quitter le mode liaison (Échap)" : "Mode liaison"}
          </Button>
        </Box>

        <SectionBand label="Budget d'heures" value={formatHours(budget ?? 0)} />
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Consommé (planning)
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color:
                budget == null || consumed === 0
                  ? "text.secondary"
                  : consumed > budget
                    ? "error.main"
                    : "success.main",
            }}
          >
            {formatHours(consumed)}
          </Typography>
        </Box>

        <SectionBand label="Postes de travail" value={String(tasks.length)} />
        <Box sx={{ px: 1.5, py: 0.5 }}>
          <SectionWorkPackageTasksPicker
            listingId={listingId}
            value={workPackage.workStationIds ?? []}
            onChange={handleWorkStationIdsChange}
            maxHeight={180}
          />
        </Box>
        {tasks.length === 0 ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", px: 1.5, py: 0.5 }}
          >
            Aucun poste ne s&apos;applique encore : liez des annotations (un
            poste ne compte que celles de son calque).
          </Typography>
        ) : (
          <List dense disablePadding>
            {tasks.map((t) => (
              <ListItem key={t.businessObjectId} sx={{ py: 0.25 }}>
                <ListItemText
                  primary={t.label}
                  secondary={
                    t.qty != null && t.hoursRatio != null
                      ? `${formatBusinessObjectNumber(t.qty, 1)} ${getBusinessObjectUnitLabel(
                          t.unit
                        )} × ${formatBusinessObjectNumber(t.hoursRatio, 2)} h/${getBusinessObjectUnitLabel(
                          t.unit
                        )}`
                      : "sans ratio"
                  }
                  slotProps={{
                    primary: { variant: "body2", noWrap: true },
                    secondary: { variant: "caption", noWrap: true },
                  }}
                />
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ ml: 1, whiteSpace: "nowrap" }}
                >
                  {t.hours != null ? formatHours(t.hours) : "—"}
                </Typography>
              </ListItem>
            ))}
          </List>
        )}

        <SectionBand
          label="Annotations liées"
          value={String(annotations.length)}
        />
        {annotations.length === 0 ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", px: 1.5, py: 0.5 }}
          >
            Activez le mode liaison puis cliquez les annotations sur la carte,
            ou sélectionnez-en plusieurs et « Lier à une tâche ».
          </Typography>
        ) : (
          <List dense disablePadding>
            {annotations.map((a) => {
              const template = templateById[a.annotationTemplateId];
              return (
                <ListItem
                  key={a.id}
                  disablePadding
                  sx={{
                    "&:hover .work-package-unlink": { visibility: "visible" },
                  }}
                  secondaryAction={
                    <IconButton
                      className="work-package-unlink"
                      size="small"
                      edge="end"
                      title="Retirer de la tâche"
                      onClick={() => handleUnlink(a)}
                      sx={{ visibility: "hidden" }}
                    >
                      <LinkOff sx={{ fontSize: 16 }} />
                    </IconButton>
                  }
                >
                  <ListItemButton
                    dense
                    onClick={() => handleSelectAnnotation(a)}
                  >
                    <Box sx={{ mr: 1, display: "flex", alignItems: "center" }}>
                      <AnnotationTemplateIcon
                        template={template}
                        size={20}
                        spriteImage={spriteImage}
                      />
                    </Box>
                    <ListItemText
                      primary={a.label || template?.label || "Annotation"}
                      secondary={baseMapNameById[a.baseMapId] || "Plan"}
                      slotProps={{
                        primary: { variant: "body2", noWrap: true },
                        secondary: { variant: "caption", noWrap: true },
                      }}
                    />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 1, whiteSpace: "nowrap" }}
                    >
                      {getAnnotationMainQtyLabel(a, a.qties)}
                    </Typography>
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}

        <Box sx={{ p: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
          <Button
            size="small"
            color="error"
            variant="outlined"
            fullWidth
            onClick={() => setOpenDelete(true)}
          >
            Supprimer la tâche
          </Button>
        </Box>
      </Box>

      {openDelete && (
        <DialogDeleteWorkPackage
          open
          workPackage={workPackage}
          onClose={() => setOpenDelete(false)}
        />
      )}
    </Box>
  );
}
