import { useMemo, useState } from "react";
import { useSelector } from "react-redux";

import {
  Box,
  Button,
  ListSubheader,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { AddLink } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import useBusinessObjectListings from "../hooks/useBusinessObjectListings";
import useBusinessObjects from "../hooks/useBusinessObjects";
import useLinkAnnotationsToBusinessObject from "../hooks/useLinkAnnotationsToBusinessObject";

import buildBusinessObjectsTree from "../utils/buildBusinessObjectsTree";
import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";

// "Lier à un ouvrage" action of the multi-annotation selection panel: a menu
// of the scope's business objects (grouped by listing, tree-indented); picking
// one links every selected annotation to it (N-N, existing pairs skipped).
// Renders nothing when the scope has no business object.
export default function SectionLinkAnnotationsToBusinessObject({
  annotationIds,
}) {
  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const listings = useBusinessObjectListings();
  const { value: businessObjects } = useBusinessObjects({ scopeId });
  const linkAnnotationsToBusinessObject = useLinkAnnotationsToBusinessObject();

  // state

  const [menuAnchor, setMenuAnchor] = useState(null);

  // helpers — one tree-flattened group per listing (hasColor: the rows of a
  // type without color, e.g. tasks, show no swatch)

  const groups = useMemo(() => {
    return (listings ?? [])
      .map((listing) => ({
        listing,
        hasColor: Boolean(
          getBusinessObjectTypeOfListing(listing).features?.color
        ),
        flatTree: buildBusinessObjectsTree(
          (businessObjects ?? []).filter((o) => o.listingId === listing.id)
        ),
      }))
      .filter((g) => g.flatTree.length > 0);
  }, [listings, businessObjects]);

  // Button wording from the types present (listings of every type are
  // offered: linking annotations to a task is the planning workflow).
  const typeKeys = new Set(
    groups.map((g) => getBusinessObjectTypeOfListing(g.listing).key)
  );
  const linkToS =
    typeKeys.size === 1
      ? getBusinessObjectTypeOfListing(groups[0]?.listing).strings.linkTo
      : "Lier à un ouvrage / une tâche";

  // handlers

  async function handlePick(businessObject) {
    setMenuAnchor(null);
    await linkAnnotationsToBusinessObject({ businessObject, annotationIds });
  }

  // render

  if (groups.length === 0) return null;

  return (
    <WhiteSectionGeneric>
      <Button
        variant="outlined"
        startIcon={<AddLink />}
        onClick={(e) => setMenuAnchor(e.currentTarget)}
        fullWidth
        size="small"
      >
        {linkToS}
      </Button>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        slotProps={{ paper: { sx: { maxHeight: 400, minWidth: 240 } } }}
      >
        {groups.flatMap(({ listing, hasColor, flatTree }) => [
          <ListSubheader key={listing.id} sx={{ lineHeight: "32px" }}>
            {listing.name}
          </ListSubheader>,
          ...flatTree.map(({ businessObject, depth }) => (
            <MenuItem
              key={businessObject.id}
              onClick={() => handlePick(businessObject)}
              sx={{ pl: 2 + depth * 2, gap: 1 }}
            >
              {hasColor && (
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    minWidth: 10,
                    borderRadius: "2px",
                    bgcolor: businessObject.color,
                  }}
                />
              )}
              <Typography variant="body2" noWrap>
                {businessObject.label}
              </Typography>
            </MenuItem>
          )),
        ])}
      </Menu>
    </WhiteSectionGeneric>
  );
}
