import { useState } from "react";
import { useSelector } from "react-redux";

import { Box, Button, Menu, MenuItem, Typography } from "@mui/material";
import { AddLink } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import useWorkPackages from "../hooks/useWorkPackages";
import useLinkAnnotationsToWorkPackage from "../hooks/useLinkAnnotationsToWorkPackage";

// "Lier à un work package" action of the multi-annotation selection panel:
// menu of the active PLANNING listing's work packages; picking one moves
// every selected annotation into it (one package per annotation and
// listing). Renders nothing outside a PLANNING listing / without package.
export default function SectionLinkAnnotationsToWorkPackage({ annotationIds }) {
  const listingId = useSelector((s) => s.businessObjects.selectedListingId);
  const listing = useSelector((s) =>
    listingId ? (s.listings.listingsById?.[listingId] ?? null) : null
  );
  const isPlanningListing = listing?.businessObjectType === "PLANNING";
  const { value: workPackages } = useWorkPackages({
    listingId: isPlanningListing ? listingId : null,
  });
  const link = useLinkAnnotationsToWorkPackage();

  const [menuAnchor, setMenuAnchor] = useState(null);

  if (!isPlanningListing || workPackages.length === 0) return null;

  async function handlePick(wp) {
    setMenuAnchor(null);
    await link({ workPackage: wp, annotationIds });
  }

  return (
    <WhiteSectionGeneric>
      <Button
        size="small"
        variant="outlined"
        fullWidth
        startIcon={<AddLink fontSize="small" />}
        onClick={(e) => setMenuAnchor(e.currentTarget)}
      >
        Lier à une tâche
      </Button>
      <Menu
        open={Boolean(menuAnchor)}
        anchorEl={menuAnchor}
        onClose={() => setMenuAnchor(null)}
      >
        {workPackages.map((wp) => (
          <MenuItem key={wp.id} onClick={() => handlePick(wp)} sx={{ gap: 1 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: "2px",
                bgcolor: wp.color,
                flexShrink: 0,
              }}
            />
            <Typography variant="body2" noWrap>
              {wp.label}
            </Typography>
          </MenuItem>
        ))}
      </Menu>
    </WhiteSectionGeneric>
  );
}
