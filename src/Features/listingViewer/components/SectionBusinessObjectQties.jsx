import { useMemo } from "react";

import { Box, Typography } from "@mui/material";

import computeBusinessObjectQties from "Features/businessObjects/utils/computeBusinessObjectQties";
import buildBusinessObjectsTree from "Features/businessObjects/utils/buildBusinessObjectsTree";
import getBusinessObjectQtyLabel from "Features/businessObjects/utils/getBusinessObjectQtyLabel";

// Quantities of a set of annotations rolled up per business object, the
// right-hand column of the SCOPE module recap for a business-objects listing.
// The annotations of such a listing are not its own: they are linked to its
// objects through db.relsBusinessObjectAnnotation, so the caller passes both
// the objects and the rels (fetched once for the whole editor) plus the
// annotations in scope — the whole listing, or a single base map's.
//
// Objects are listed in tree order; those without a unit (title rows) or
// without any quantity are skipped.
export default function SectionBusinessObjectQties({
  businessObjects,
  rels,
  annotations,
}) {
  // strings

  const emptyS = "Aucun ouvrage quantifié";

  // helpers

  const rows = useMemo(() => {
    if (!businessObjects?.length) return [];

    const { qtiesByObjectId } = computeBusinessObjectQties({
      rels,
      annotations,
    });

    return buildBusinessObjectsTree(businessObjects)
      .map(({ businessObject }) => {
        const qties = qtiesByObjectId[businessObject.id];
        if (!qties) return null;
        const qtyLabel = getBusinessObjectQtyLabel(businessObject.unit, qties);
        if (!qtyLabel) return null;
        return { id: businessObject.id, label: businessObject.label, qtyLabel };
      })
      .filter(Boolean);
  }, [businessObjects, rels, annotations]);

  // render

  if (!rows.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyS}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
      {rows.map((row) => (
        <Box
          key={row.id}
          sx={{ display: "flex", alignItems: "center", gap: 1 }}
        >
          <Typography variant="body2" noWrap sx={{ flex: 1 }}>
            {row.label}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            noWrap
            sx={{ fontFamily: "monospace", fontWeight: 500 }}
          >
            {row.qtyLabel}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
