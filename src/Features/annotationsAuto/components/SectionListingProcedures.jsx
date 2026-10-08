import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setToaster } from "Features/layout/layoutSlice";

import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import useListingProcedureSourceIds from "../hooks/useListingProcedureSourceIds";
import getProcedureOutputs from "../services/getProcedureOutputs";

import {
  Box,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import { lighten } from "@mui/material/styles";
import {
  DeleteSweep,
  ExpandMore,
  PlayArrow,
  Refresh,
} from "@mui/icons-material";

import DialogProcedureLaunch from "./DialogProcedureLaunch";
import DialogPromptIa from "Features/promptIa/components/DialogPromptIa";
import getPromptIaOutputs from "Features/promptIa/services/getPromptIaOutputs";
import {
  PROMPT_IA_PROCEDURE,
  isPromptIaProcedure,
} from "Features/promptIa/utils/promptIaProcedure";

/**
 * "Dessin auto" section of a listing, for the procedures linked to it
 * (`listing.procedureKeys`, edited in the listing properties), on one line:
 * active procedure name — launch button — procedure selector (only when the
 * listing links several procedures).
 *
 * The launch button opens DialogProcedureLaunch (procedure properties, number
 * of source annotations concerned, launch buttons). While the procedure has
 * live outputs from the base map's sources, it reads "update" instead of
 * "play" and a delete button sweeps those outputs (same scope as the reset of
 * ProcedureActionButtons: getProcedureOutputs).
 *
 * Sources of the run: useListingProcedureSourceIds.
 *
 * A listing whose Prompt IA is enabled (listing.promptIaEnabled) also lists
 * the virtual "Prompt IA" procedure: no sources, its play button opens
 * DialogPromptIa (zip download, result import). Its outputs are the
 * annotations the Prompt IA created on the base map and that the user has
 * not edited since (getPromptIaOutputs): the delete button sweeps them.
 *
 * Renders nothing when the listing links no procedure.
 */
export default function SectionListingProcedures({ listingId, baseMapId, sx }) {
  const dispatch = useDispatch();

  // strings

  const captionS = "Dessin auto";
  const launchS = "Lancer la procédure";
  const openPromptIaS = "Ouvrir le Prompt IA";
  const updateS = "Mettre à jour (supprimer puis relancer)";
  const selectS = "Choisir la procédure";

  // data

  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];

  const listing = useLiveQuery(
    () => (listingId ? db.listings.get(listingId) : null),
    [listingId]
  );

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );
  const deleteAnnotations = useDeleteAnnotations();

  // state

  const [activeKey, setActiveKey] = useState(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // helpers

  const registryProcedures = (listing?.procedureKeys ?? [])
    .map((key) => procedures.find((p) => p.key === key))
    .filter(Boolean);
  const hasRegistryProcedures = registryProcedures.length > 0;
  const linkedProcedures = listing?.promptIaEnabled
    ? [...registryProcedures, PROMPT_IA_PROCEDURE]
    : registryProcedures;
  const hasProcedures = linkedProcedures.length > 0;
  const procedure =
    linkedProcedures.find((p) => p.key === activeKey) ?? linkedProcedures[0];
  const isPromptIa = isPromptIaProcedure(procedure);
  const showSelector = linkedProcedures.length > 1;

  // data - sources of the active procedure (none for the Prompt IA)

  const getSourceAnnotationIds = useListingProcedureSourceIds({
    listingId,
    baseMapId,
    enabled: hasRegistryProcedures,
  });

  const sourceAnnotationIds =
    procedure && !isPromptIa ? getSourceAnnotationIds(procedure) : [];
  const sourceKey = sourceAnnotationIds.join(",");

  // data - live outputs of the active procedure from these sources, or of
  // the Prompt IA on the base map (display only: the delete re-reads them
  // from Dexie at call time).

  function readOutputs() {
    if (!procedure) return [];
    if (isPromptIa) return getPromptIaOutputs({ listingId, baseMapId });
    return getProcedureOutputs({
      projectId,
      procedureKey: procedure.key,
      sourceAnnotationIds,
    });
  }

  const createdAnnotations = useLiveQuery(readOutputs, [
    projectId,
    listingId,
    baseMapId,
    procedure?.key,
    isPromptIa,
    sourceKey,
    annotationsUpdatedAt,
  ]);
  const createdCount = createdAnnotations?.length ?? 0;
  const hasOutputs = createdCount > 0;
  const deleteS = isPromptIa
    ? `Supprimer les ${createdCount} annotation(s) créée(s) par le Prompt IA (non modifiées depuis)`
    : `Supprimer les ${createdCount} annotation(s) créée(s)`;

  // handlers

  function handleSelect(key) {
    setActiveKey(key);
    setMenuAnchorEl(null);
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      const outputs = await readOutputs();
      const ids = outputs.map((a) => a.id);
      if (ids.length === 0) return;
      await deleteAnnotations(ids);
      dispatch(
        setToaster({ message: `${ids.length} annotation(s) supprimée(s)` })
      );
    } finally {
      setDeleting(false);
    }
  }

  // render

  if (!hasProcedures) return null;

  return (
    // white band around the tinted section
    <Box sx={{ bgcolor: "background.paper", px: 1, py: 0.75, ...sx }}>
      <Box
        sx={{
          bgcolor: (theme) => lighten(theme.palette.secondary.main, 0.85),
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        {/* active procedure + play + selector */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 0.5,
            pl: 1.25,
            pr: 0.5,
            py: 0.25,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "block",
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                lineHeight: 1.4,
              }}
            >
              {captionS}
            </Typography>
            <Typography variant="body2" noWrap sx={{ fontWeight: "bold" }}>
              {procedure.label}
            </Typography>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            {deleting && <CircularProgress size={14} sx={{ mr: 0.5 }} />}
            {hasOutputs && (
              <Tooltip title={deleteS}>
                <span>
                  <IconButton
                    size="small"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    <DeleteSweep sx={{ fontSize: 18 }} />
                  </IconButton>
                </span>
              </Tooltip>
            )}
            <Tooltip
              title={
                isPromptIa ? openPromptIaS : hasOutputs ? updateS : launchS
              }
            >
              <span>
                <IconButton
                  size="small"
                  color="secondary"
                  onClick={() => setLaunchOpen(true)}
                  // the Prompt IA zip is built from the displayed base map
                  disabled={deleting || (isPromptIa && !baseMapId)}
                >
                  {hasOutputs && !isPromptIa ? (
                    <Refresh sx={{ fontSize: 20 }} />
                  ) : (
                    <PlayArrow sx={{ fontSize: 20 }} />
                  )}
                </IconButton>
              </span>
            </Tooltip>
            {showSelector && (
              <Tooltip title={selectS}>
                <IconButton
                  size="small"
                  onClick={(e) => setMenuAnchorEl(e.currentTarget)}
                >
                  <ExpandMore sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Box>

      {showSelector && (
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={() => setMenuAnchorEl(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          {linkedProcedures.map((p) => (
            <MenuItem
              key={p.key}
              dense
              selected={p.key === procedure.key}
              onClick={() => handleSelect(p.key)}
            >
              {p.label}
            </MenuItem>
          ))}
        </Menu>
      )}

      {launchOpen && isPromptIa && (
        <DialogPromptIa
          key={procedure.key}
          open={launchOpen}
          onClose={() => setLaunchOpen(false)}
          listingId={listingId}
          baseMapId={baseMapId}
        />
      )}

      {launchOpen && !isPromptIa && (
        <DialogProcedureLaunch
          // per-procedure instance: no dialog state carried over when the
          // active procedure changes
          key={procedure.key}
          open={launchOpen}
          onClose={() => setLaunchOpen(false)}
          procedure={procedure}
          listingId={listingId}
          baseMapId={baseMapId}
          sourceAnnotationIds={sourceAnnotationIds}
        />
      )}
    </Box>
  );
}
