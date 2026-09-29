import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";

import useBusinessObjectListings from "../hooks/useBusinessObjectListings";
import { DEFAULT_BUSINESS_OBJECT_TYPE_KEY } from "../data/businessObjectTypesCatalog";

import SelectorViewerBusinessObjectListing from "./SelectorViewerBusinessObjectListing";
import BusinessObjectsTree from "./BusinessObjectsTree";

// Business objects view of the Viewer module's left panel: read-only tree of
// one listing of `typeKey` (quantities, solo display, linked documents,
// selection) — no creation, no reordering, no annotation linking. The
// displayed listing is the Viewer's own (panelDrawing slice), the first one
// by default.
export default function PanelViewerBusinessObjects({
  typeKey = DEFAULT_BUSINESS_OBJECT_TYPE_KEY,
  header,
}) {
  // strings

  const descriptionS =
    "Objets de la liste, en lecture seule : contrôlez les quantités et " +
    "isolez les annotations liées.";

  // data

  const listings = useBusinessObjectListings({ typeKey });
  const storedListingId = useSelector(
    (s) => s.panelDrawing.viewerBusinessObjectListingIdByType[typeKey]
  );

  // helpers

  const activeListing =
    listings?.find((l) => l.id === storedListingId) ?? listings?.[0] ?? null;

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: 1,
        minHeight: 0,
        bgcolor: "background.default",
        borderRight: "1px solid",
        borderColor: "divider",
      }}
    >
      {header}
      <Typography
        variant="caption"
        sx={{ px: 2, pb: 1, color: "text.secondary" }}
      >
        {descriptionS}
      </Typography>

      {listings?.length > 1 && (
        <SelectorViewerBusinessObjectListing
          typeKey={typeKey}
          listings={listings}
          activeListing={activeListing}
        />
      )}

      <Box sx={{ overflow: "auto", flex: 1, minHeight: 0 }}>
        {activeListing && (
          <BusinessObjectsTree
            key={activeListing.id}
            listing={activeListing}
            readOnly
          />
        )}
      </Box>
    </Box>
  );
}
