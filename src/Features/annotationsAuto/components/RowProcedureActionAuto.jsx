import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setListingActiveProcedureKey } from "../annotationsAutoSlice";

import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import hasProcedureParams from "../utils/hasProcedureParams";
import getProceduresForAnnotation from "../utils/getProceduresForAnnotation";

import { Box, IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import { lighten } from "@mui/material/styles";
import { ExpandMore } from "@mui/icons-material";

import RowProcedureLauncher from "./RowProcedureLauncher";
import SectionProcedureParams from "./SectionProcedureParams";

/**
 * Toolbar rows (between quantities and actions) for an annotation that can
 * source one or several ANNOTATIONS_CREATOR procedures — linked by its
 * template, by its listing (source mapping categories) or by its type
 * (getProceduresForAnnotation). A single band for one of them: an optional
 * parameters row (lighter tint of the launch band, so it reads as attached to
 * it) on top of the launch band itself — left = procedure name, right = play /
 * reset / refresh applied to this single annotation as source, then a
 * selector arrow when several procedures apply.
 *
 * Procedure shown, by priority: the one picked with the arrow (for this
 * annotation), the active procedure of the listing's "Dessin auto" band
 * (annotationsAuto.activeProcedureKeyByListingId), the procedure that created
 * this annotation, the first one. Picking a procedure of the listing also
 * makes it the listing's active one, so the "Dessin auto" band follows.
 *
 * `onlyProcedureKeys` (optional) restricts the choice to a subset of the
 * linked procedures.
 */
export default function RowProcedureActionAuto({
  annotation,
  onlyProcedureKeys = null,
}) {
  const dispatch = useDispatch();

  // strings

  const selectS = "Choisir la procédure";

  // data

  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];

  // listing-level links (listing.procedureKeys + sourceMappingCategories)
  const listingId = annotation?.listingId;
  const listing = useLiveQuery(
    () => (listingId ? db.listings.get(listingId) : null),
    [listingId]
  );
  const listingActiveKey = useSelector((s) =>
    listingId
      ? s.annotationsAuto.activeProcedureKeyByListingId[listingId]
      : null
  );

  const linkedProcedures = getProceduresForAnnotation(annotation, procedures, {
    listing,
  }).filter((p) => !onlyProcedureKeys || onlyProcedureKeys.includes(p.key));

  // state

  // {annotationId, key} — a pick only holds for the annotation it was made on
  const [picked, setPicked] = useState(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);

  // helpers

  const pickedKey =
    picked && picked.annotationId === annotation?.id ? picked.key : null;
  const findLinked = (key) =>
    key ? linkedProcedures.find((p) => p.key === key) : null;
  const procedure =
    findLinked(pickedKey) ??
    findLinked(listingActiveKey) ??
    findLinked(annotation?.autoCreatedByProcedureKey) ??
    linkedProcedures[0];
  const showSelector = linkedProcedures.length > 1;

  // handlers

  function handleSelect(key) {
    setPicked({ annotationId: annotation?.id, key });
    setMenuAnchorEl(null);
    if ((listing?.procedureKeys ?? []).includes(key)) {
      dispatch(setListingActiveProcedureKey({ listingId, procedureKey: key }));
    }
  }

  // render

  if (!procedure) return null;

  return (
    <>
      <RowProcedureActionAutoBand
        key={procedure.key}
        annotation={annotation}
        procedure={procedure}
        actions={
          showSelector ? (
            <Tooltip title={selectS}>
              <IconButton
                size="small"
                onClick={(e) => setMenuAnchorEl(e.currentTarget)}
              >
                <ExpandMore sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          ) : null
        }
      />

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
    </>
  );
}

// One procedure band. Source of the launch: this single annotation — or, for
// an output of this procedure, its source: play / reset / refresh on a
// generated row must operate on the annotation it was created from, not
// relaunch the procedure with itself as source.
function RowProcedureActionAutoBand({ annotation, procedure, actions }) {
  // helpers

  const ownSourceId =
    annotation?.autoCreatedByProcedureKey === procedure.key &&
    annotation?.autoCreatedFrom
      ? annotation.autoCreatedFrom
      : annotation?.id;
  const sourceAnnotationIds = [ownSourceId];

  // render

  return (
    <Box>
      {hasProcedureParams(procedure) && (
        <SectionProcedureParams
          procedure={procedure}
          row
          hideHelperText
          sx={{
            px: 1.25,
            py: 0.25,
            bgcolor: (theme) => lighten(theme.palette.secondary.main, 0.93),
          }}
        />
      )}

      <RowProcedureLauncher
        procedure={procedure}
        baseMapId={annotation?.baseMapId}
        sourceAnnotationIds={sourceAnnotationIds}
        actions={actions}
        sx={{ borderBottom: "1px solid", borderColor: "divider" }}
      />
    </Box>
  );
}
