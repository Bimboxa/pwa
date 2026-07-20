import { useMemo, useState } from "react";
import { useSelector } from "react-redux";

import {
  Box,
  Chip,
  Menu,
  MenuItem,
  ListSubheader,
  Typography,
} from "@mui/material";
import { Add } from "@mui/icons-material";

import useZoningListings from "../hooks/useZoningListings";
import useZones from "../hooks/useZones";
import useRelsZoneAnnotation from "../hooks/useRelsZoneAnnotation";
import useAddZoneToAnnotation from "../hooks/useAddZoneToAnnotation";
import useRemoveZoneFromAnnotation from "../hooks/useRemoveZoneFromAnnotation";
import buildZonesTree from "../utils/buildZonesTree";

export default function SectionAnnotationZones({ annotation }) {
  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const zoningListings = useZoningListings();
  const { value: scopeZones } = useZones({ scopeId });
  const { value: rels } = useRelsZoneAnnotation({
    annotationId: annotation?.id,
  });

  const addZoneToAnnotation = useAddZoneToAnnotation();
  const removeZoneFromAnnotation = useRemoveZoneFromAnnotation();

  // state

  const [menuAnchor, setMenuAnchor] = useState(null);

  // helpers

  const zoneById = useMemo(() => {
    const map = {};
    (scopeZones ?? []).forEach((z) => {
      map[z.id] = z;
    });
    return map;
  }, [scopeZones]);

  const listingNameById = useMemo(() => {
    const map = {};
    (zoningListings ?? []).forEach((l) => {
      map[l.id] = l.name;
    });
    return map;
  }, [zoningListings]);

  // one flattened tree per zoning listing, for the add menu
  const treesByListing = useMemo(() => {
    return (zoningListings ?? []).map((listing) => ({
      listing,
      flatTree: buildZonesTree(
        (scopeZones ?? []).filter((z) => z.listingId === listing.id)
      ),
    }));
  }, [zoningListings, scopeZones]);

  const hasZonings = (zoningListings?.length ?? 0) > 0;

  // handlers

  async function handleAddZone(zone) {
    setMenuAnchor(null);
    await addZoneToAnnotation({ annotation, zone });
  }

  // render

  if (!annotation || !hasZonings) return null;

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="caption" color="text.secondary">
        Zones
      </Typography>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
        {(rels ?? []).map((rel) => {
          const zone = zoneById[rel.zoneId];
          if (!zone) return null;
          const listingName = listingNameById[rel.listingId];
          return (
            <Chip
              key={rel.id}
              size="small"
              label={listingName ? `${listingName} / ${zone.label}` : zone.label}
              sx={{
                "& .MuiChip-icon": { color: zone.color },
              }}
              icon={
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    bgcolor: zone.color,
                    ml: 0.5,
                  }}
                />
              }
              onDelete={() => removeZoneFromAnnotation(rel.id)}
            />
          );
        })}

        <Chip
          size="small"
          variant="outlined"
          icon={<Add sx={{ fontSize: 14 }} />}
          label="Zone"
          onClick={(e) => setMenuAnchor(e.currentTarget)}
        />
      </Box>

      <Menu
        open={Boolean(menuAnchor)}
        anchorEl={menuAnchor}
        onClose={() => setMenuAnchor(null)}
      >
        {treesByListing.flatMap(({ listing, flatTree }) => [
          <ListSubheader key={listing.id} sx={{ lineHeight: "32px" }}>
            {listing.name}
          </ListSubheader>,
          ...flatTree.map(({ zone, depth }) => (
            <MenuItem
              key={zone.id}
              onClick={() => handleAddZone(zone)}
              sx={{ pl: 2 + depth * 2 }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: zone.color,
                  mr: 1,
                }}
              />
              {zone.label}
            </MenuItem>
          )),
        ])}
      </Menu>
    </Box>
  );
}
