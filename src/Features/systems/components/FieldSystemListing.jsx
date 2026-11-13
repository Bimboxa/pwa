import { useMemo } from "react";
import { useSelector } from "react-redux";

import { Box, MenuItem, Select, Typography } from "@mui/material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import useListings from "Features/listings/hooks/useListings";

import isSystemListing from "../utils/isSystemListing";

// Field of a SYSTEM annotation template: the system listing it points to
// (`template.systemListingId`) — one of the system listings of the scope.
export default function FieldSystemListing({ value, onChange, hostListingId }) {
  // strings

  const labelS = "Système";
  const placeholderS = "Choisir un système…";
  const emptyS =
    "Aucune liste ne définit de système dans ce plan de repérage (propriétés de la liste, onglet Avancé).";

  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const { value: listings } = useListings({
    filterByScopeId: scopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
    includeDisabledListings: true,
  });

  // helpers

  const systemListings = useMemo(
    () =>
      (listings ?? []).filter(
        (l) => isSystemListing(l) && l.id !== hostListingId
      ),
    [listings, hostListingId]
  );
  const selectedId = systemListings.some((l) => l.id === value) ? value : "";

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
          {labelS}
        </Typography>
        {systemListings.length > 0 && (
          <Select
            size="small"
            displayEmpty
            value={selectedId}
            onChange={(e) => onChange(e.target.value || null)}
            sx={{ minWidth: 160, fontSize: 13 }}
            renderValue={(id) =>
              systemListings.find((l) => l.id === id)?.name ?? (
                <Typography variant="body2" color="text.disabled">
                  {placeholderS}
                </Typography>
              )
            }
          >
            {systemListings.map((l) => (
              <MenuItem key={l.id} value={l.id} dense>
                {l.name}
              </MenuItem>
            ))}
          </Select>
        )}
      </Box>
      {systemListings.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          {emptyS}
        </Typography>
      )}
    </WhiteSectionGeneric>
  );
}
