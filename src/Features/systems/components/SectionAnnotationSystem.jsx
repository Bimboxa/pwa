import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";

import db from "App/db/db";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import FieldsSystemParams from "./FieldsSystemParams";
import {
  SYSTEM_DISPLAY_DETAIL,
  SYSTEM_DISPLAY_EDITOR_2D,
  SYSTEM_DISPLAY_EDITOR_3D,
  SYSTEM_DISPLAY_SOURCE,
} from "../constants/systemConstants";
import useSystemProcedures from "../hooks/useSystemProcedures";
import getSystemDisplayMode from "../utils/getSystemDisplayMode";
import getSystemParams from "../utils/getSystemParams";

const EDITORS = [
  { key: SYSTEM_DISPLAY_EDITOR_2D, label: "2D" },
  { key: SYSTEM_DISPLAY_EDITOR_3D, label: "3D" },
];

// « Système » white section of the SOURCE annotation of a system instance
// (annotation properties panel): the display mode of the instance in each
// editor — the source annotation or the generated detail
// (`annotation.systemDisplay`) — and the parameters of this instance
// (`annotation.procedureParams[procedureKey]`, over the listing defaults).
// The generated annotations are kept in sync by useSystemsSync.
// Self-hiding on any other annotation.
export default function SectionAnnotationSystem({ annotation }) {
  // strings

  const titleS = "Système";
  const displayS = "Affichage";
  const sourceS = "Source";
  const detailS = "Détail";
  const countS = (n) =>
    n > 1 ? `${n} annotations générées` : `${n} annotation générée`;

  // data

  const updateAnnotation = useUpdateAnnotation();
  const procedures = useSystemProcedures();
  const listingsById = useSelector((s) => s.listings.listingsById);
  const annotationId = annotation?.id;

  // The stored row: the display modes, the parameters and the count written
  // back by the sync.
  const row = useLiveQuery(
    () => (annotationId ? db.annotations.get(annotationId) : null),
    [annotationId]
  );

  // helpers

  const listing = listingsById?.[row?.listingId] ?? null;
  const procedureKey = listing?.system?.procedureKey;
  const procedure = procedures.find((p) => p.key === procedureKey) ?? null;
  const params = getSystemParams({ source: row, listing, procedure });
  const count = row?.systemApplied?.count;

  // handlers

  async function handleDisplayChange(editorKey, mode) {
    if (!mode || !annotationId) return;
    await updateAnnotation({
      id: annotationId,
      systemDisplay: { ...(row?.systemDisplay ?? {}), [editorKey]: mode },
    });
  }

  async function handleParamChange(key, value) {
    if (!annotationId || !procedureKey) return;
    await updateAnnotation({
      id: annotationId,
      procedureParams: {
        ...(row?.procedureParams ?? {}),
        [procedureKey]: {
          ...(row?.procedureParams?.[procedureKey] ?? {}),
          [key]: value,
        },
      },
    });
  }

  // render

  if (!row?.systemApplied || !listing?.system) return null;

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
        <WhiteSectionTitle>
          {listing.name ? `${titleS} — ${listing.name}` : titleS}
        </WhiteSectionTitle>
        {EDITORS.map((editor) => (
          <Box
            key={editor.key}
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <Typography variant="body2" sx={{ flex: 1 }}>
              {`${displayS} ${editor.label}`}
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={getSystemDisplayMode(row, editor.key)}
              onChange={(e, mode) => handleDisplayChange(editor.key, mode)}
            >
              <ToggleButton
                value={SYSTEM_DISPLAY_SOURCE}
                sx={{ py: 0.25, px: 1, textTransform: "none", fontSize: 12 }}
              >
                {sourceS}
              </ToggleButton>
              <ToggleButton
                value={SYSTEM_DISPLAY_DETAIL}
                sx={{ py: 0.25, px: 1, textTransform: "none", fontSize: 12 }}
              >
                {detailS}
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        ))}
        <FieldsSystemParams
          procedure={procedure}
          values={params}
          onChange={handleParamChange}
        />
        {Number.isInteger(count) && (
          <Typography variant="caption" color="text.secondary">
            {countS(count)}
          </Typography>
        )}
      </Box>
    </WhiteSectionGeneric>
  );
}
