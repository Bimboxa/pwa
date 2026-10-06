import { useMemo, useState } from "react";
import { useSelector } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useScopes from "Features/scopes/hooks/useScopes";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useListings from "../hooks/useListings";
import useLinkedListings from "../hooks/useLinkedListings";
import useLinkListingsToScope from "../hooks/useLinkListingsToScope";
import useListingItemsCountById from "../hooks/useListingItemsCountById";

import {
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import ListScopes from "Features/scopes/components/ListScopes";
import AvatarListing from "./AvatarListing";

// « Depuis un autre Krto »: pick another scope of the project on the left,
// tick its drawing listings on the right, "Ajouter" links them into the
// selected scope (db.relsScopeListing — the listings keep their own scopeId
// and are read-only here). Scopes created from a Krto configuration listed
// in the host configuration's `sourceConfigurationKeys` come first, under
// "Suggérés"; the others stay available.
export default function DialogAddListingsFromScope({ open, onClose }) {
  // strings

  const appConfig = useAppConfig();
  const scopeS = appConfig?.strings?.scope?.nameSingular ?? "plan de repérage";

  const titleS = `Depuis un autre ${scopeS}`;
  const suggestedS = "Suggérés";
  const othersS = "Autres";
  const allS = appConfig?.strings?.scope?.namePlural ?? "Plans de repérage";
  const noScopeS = `Aucun autre ${scopeS} dans ce projet.`;
  const pickScopeS = `Sélectionnez un ${scopeS} pour voir ses listes.`;
  const noListingS = "Aucune liste à ajouter.";
  const annotationsCountS = (count) =>
    count === 1 ? "1 annotation" : `${count} annotations`;
  const readOnlyHintS = `Les listes ajoutées restent en lecture seule ici : modifiez-les depuis leur ${scopeS}.`;
  const addS = "Ajouter";

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: hostScope } = useSelectedScope();
  const { value: scopes } = useScopes({ filterByProjectId: projectId });
  const { linkedSourceByListingId } = useLinkedListings();
  const linkListingsToScope = useLinkListingsToScope();

  // state

  const [sourceScopeId, setSourceScopeId] = useState(null);
  const [selection, setSelection] = useState([]);
  const [loading, setLoading] = useState(false);

  // helpers - scopes split

  const sourceConfigurationKeys = useMemo(() => {
    const items = appConfig?.features?.krtoConfigurations?.items ?? [];
    const configuration = items.find(
      (item) => item.key === hostScope?.presetScopeKey
    );
    return configuration?.sourceConfigurationKeys ?? [];
  }, [appConfig, hostScope?.presetScopeKey]);

  const { suggested, others } = useMemo(() => {
    const candidates = (scopes ?? [])
      .filter((scope) => scope.id !== hostScope?.id && !scope.deletedAt)
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    const suggestedKeys = new Set(sourceConfigurationKeys);
    const suggested = candidates.filter(
      (scope) => scope.presetScopeKey && suggestedKeys.has(scope.presetScopeKey)
    );
    const others = candidates.filter((scope) => !suggested.includes(scope));
    return { suggested, others };
  }, [scopes, hostScope?.id, sourceConfigurationKeys]);

  const hasCandidates = suggested.length + others.length > 0;

  // helpers - source scope listings (paternity only: its OWN drawing
  // listings — a listing the source itself borrowed is not chained)

  const { value: sourceListingsRaw } = useListings({
    filterByProjectId: projectId,
    filterByScopeId: sourceScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });

  const sourceListings = useMemo(() => {
    if (!sourceScopeId) return [];
    return (sourceListingsRaw ?? []).filter(
      (l) => l.scopeId === sourceScopeId && !linkedSourceByListingId[l.id]
    );
  }, [sourceListingsRaw, sourceScopeId, linkedSourceByListingId]);

  const countById = useListingItemsCountById(sourceListings);

  const selectedListings = sourceListings.filter((l) =>
    selection.includes(l.id)
  );
  const disabled = selectedListings.length === 0 || loading;

  // handlers

  function handleScopeClick(scope) {
    setSourceScopeId(scope.id);
    setSelection([]);
  }

  function handleListingClick(listing) {
    setSelection((prev) =>
      prev.includes(listing.id)
        ? prev.filter((id) => id !== listing.id)
        : [...prev, listing.id]
    );
  }

  async function handleAdd() {
    if (disabled) return;
    setLoading(true);
    try {
      await linkListingsToScope(selectedListings);
    } finally {
      setLoading(false);
    }
    onClose?.();
  }

  // render

  const renderScopesSection = (label, items) =>
    items.length > 0 && (
      <Box>
        <Typography
          variant="overline"
          sx={{ px: 2, color: "text.disabled", letterSpacing: 1 }}
        >
          {label}
        </Typography>
        <ListScopes
          scopes={items}
          selection={sourceScopeId ? [sourceScopeId] : []}
          onClick={handleScopeClick}
        />
      </Box>
    );

  return (
    <DialogGeneric open={open} onClose={onClose} maxWidth={false}>
      <Box sx={{ width: 760, display: "flex", flexDirection: "column" }}>
        <Box sx={{ p: 3, pb: 1, position: "relative" }}>
          <IconButton
            size="small"
            onClick={() => onClose?.()}
            sx={{ position: "absolute", top: 12, right: 12 }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
          <Typography variant="h6">{titleS}</Typography>
          <Typography variant="caption" color="text.secondary">
            {readOnlyHintS}
          </Typography>
        </Box>

        <Divider />

        <Box sx={{ display: "flex", height: 380, minHeight: 0 }}>
          {/* Left: scopes of the project */}
          <Box
            sx={{
              width: 300,
              flexShrink: 0,
              overflow: "auto",
              borderRight: "1px solid",
              borderColor: "divider",
              py: 1,
            }}
          >
            {!hasCandidates ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                {noScopeS}
              </Typography>
            ) : suggested.length > 0 ? (
              <>
                {renderScopesSection(suggestedS, suggested)}
                {renderScopesSection(othersS, others)}
              </>
            ) : (
              renderScopesSection(allS, others)
            )}
          </Box>

          {/* Right: listings of the picked scope */}
          <Box sx={{ flex: 1, minWidth: 0, overflow: "auto" }}>
            {!sourceScopeId ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                {pickScopeS}
              </Typography>
            ) : sourceListings.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                {noListingS}
              </Typography>
            ) : (
              <List dense disablePadding>
                {sourceListings.map((listing) => {
                  const selected = selection.includes(listing.id);
                  return (
                    <ListItem key={listing.id} disablePadding divider>
                      <ListItemButton
                        selected={selected}
                        onClick={() => handleListingClick(listing)}
                        sx={{ gap: 1.5, py: 1 }}
                      >
                        <AvatarListing
                          listing={listing}
                          size={32}
                          variant={selected ? "selected" : "visible"}
                        />
                        <ListItemText
                          primary={listing.name ?? listing.label ?? "Liste"}
                          secondary={annotationsCountS(
                            countById?.[listing.id] ?? 0
                          )}
                          primaryTypographyProps={{
                            variant: "body2",
                            noWrap: true,
                            fontWeight: selected ? 600 : 400,
                          }}
                          secondaryTypographyProps={{ variant: "caption" }}
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            )}
          </Box>
        </Box>

        <Divider />

        <Box sx={{ p: 2, display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="contained"
            color="secondary"
            disabled={disabled}
            onClick={handleAdd}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {addS}
            {selectedListings.length > 0 ? ` (${selectedListings.length})` : ""}
          </Button>
        </Box>
      </Box>
    </DialogGeneric>
  );
}
