import { useState, useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import {
  DialogTitle,
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Checkbox,
  Typography,
} from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import FieldCheck from "Features/form/components/FieldCheck";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import TitleBlockFieldsForm from "Features/titleBlocks/components/TitleBlockFieldsForm";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useTitleBlockManifest from "Features/titleBlocks/hooks/useTitleBlockManifest";
import useDataMapping from "Features/appConfig/hooks/useDataMapping";
import getTitleBlockPrefillValues from "Features/titleBlocks/utils/getTitleBlockPrefillValues";
import getTitleBlockPlaceholders from "Features/titleBlocks/utils/getTitleBlockPlaceholders";

const thumbnailSx = {
  width: 40,
  height: 40,
  objectFit: "cover",
  objectPosition: "top",
  borderRadius: 0.5,
  border: (theme) => `1px solid ${theme.palette.divider}`,
  mr: 1,
};

const placeholderSx = {
  width: 40,
  height: 40,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  bgcolor: "action.hover",
  borderRadius: 0.5,
  mr: 1,
};

export default function DialogCreatePortfolio({ open, onClose, onCreate }) {
  // strings

  const titleS = "Nouveau carnet de plans";
  const labelS = "Nom";
  const createS = "Créer";
  const detailsPortfolioS = "Carnet de détails";
  const noFolioS = "Aucun folio";
  const noDetailsS = "Aucun détail dans le scope";
  const detailS = "Détail";
  const pageS = "Page";
  const titleBlockS = "Cartouche";
  const baseMapsS = "Fonds de plan";
  const noBaseMapsS = "Aucun fond de plan annoté";
  const annotationsS = "annotations";
  const detailsS = "détails";
  const detailsSectionS = "Détails";
  const baseMapUncheckedS = "Fond de plan décoché";

  // state

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isDetailsPortfolio, setIsDetailsPortfolio] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedBaseMapIds, setSelectedBaseMapIds] = useState(new Set());
  const [titleBlockValues, setTitleBlockValues] = useState({});

  // data

  const titleBlockManifest = useTitleBlockManifest(null);
  const { object: dataMapping } = useDataMapping();

  // Same content filters as useAnnotationsCountByBaseMapId, minus the hidden
  // listings (a display toggle, not a content criterion).
  const annotations = useAnnotationsV2({
    caller: "DialogCreatePortfolio",
    filterBySelectedScope: true,
    excludeProfileTemplates: true,
    hideBaseMapAnnotations: true,
    excludeIsForBaseMapsListings: true,
    excludeBgAnnotations: true,
    ignoreSolo: true,
    enabled: open,
  });

  const details = useMemo(
    () => annotations?.filter((a) => a.type === "DETAIL") ?? [],
    [annotations]
  );

  // annotated baseMaps: DETAIL annotations only for a details portfolio,
  // any annotation otherwise
  const countByBaseMapId = useMemo(() => {
    const source = isDetailsPortfolio ? details : (annotations ?? []);
    const counts = {};
    for (const a of source) {
      if (a.baseMapId) counts[a.baseMapId] = (counts[a.baseMapId] ?? 0) + 1;
    }
    return counts;
  }, [annotations, details, isDetailsPortfolio]);

  const { value: baseMaps } = useBaseMaps();
  const baseMapsListings = useProjectBaseMapListings({ excludeDisabled: true });

  // base map tree order: listings by rank, then baseMaps by sortIndex
  const orderedBaseMaps = useMemo(() => {
    if (!baseMaps || !baseMapsListings) return [];
    const result = [];
    for (const listing of baseMapsListings) {
      for (const baseMap of baseMaps) {
        if (baseMap.listingId !== listing.id) continue;
        if (!(countByBaseMapId[baseMap.id] > 0)) continue;
        result.push({ baseMap, listingName: listing.name });
      }
    }
    return result;
  }, [baseMaps, baseMapsListings, countByBaseMapId]);

  const listingNames = [
    ...new Set(orderedBaseMaps.map((item) => item.listingName)),
  ];
  const showListingHeaders = listingNames.length > 1;

  // Detail baseMap records (thumbnail + page number of each linked detail).
  const detailBaseMapIdsSignature = [
    ...new Set(details.map((d) => d.detailBaseMapId).filter(Boolean)),
  ].join(",");

  const detailBaseMapById = useLiveQuery(async () => {
    const ids = detailBaseMapIdsSignature
      ? detailBaseMapIdsSignature.split(",")
      : [];
    if (!ids.length) return {};
    const records = await db.baseMaps.bulkGet(ids);
    const byId = {};
    for (const record of records) {
      if (record && !record.deletedAt) byId[record.id] = record;
    }
    return byId;
  }, [detailBaseMapIdsSignature]);

  // baseMap.detailRef is the displayed bubble reference; annotation label is
  // the legacy fallback (same rule as useCreateDetailsPortfolio /
  // getFolioDetailRef).
  const getDetailRef = (detail) =>
    (detail.detailBaseMapId &&
      detailBaseMapById?.[detail.detailBaseMapId]?.detailRef) ||
    detail.label ||
    "";

  const sortedDetails = useMemo(
    () =>
      [...details].sort((a, b) =>
        getDetailRef(a).localeCompare(getDetailRef(b), undefined, {
          numeric: true,
        })
      ),
    [details, detailBaseMapById]
  );

  // effects - prefill title block fields from data mapping on open

  useEffect(() => {
    if (!open) return;
    setTitleBlockValues(
      getTitleBlockPrefillValues(titleBlockManifest, dataMapping)
    );
  }, [open]);

  // effects - check all annotated baseMaps by default

  const baseMapIdsSignature = orderedBaseMaps
    .map((item) => item.baseMap.id)
    .join(",");

  useEffect(() => {
    setSelectedBaseMapIds(
      new Set(orderedBaseMaps.map((item) => item.baseMap.id))
    );
  }, [baseMapIdsSignature, isDetailsPortfolio]);

  // effects - check all details (with a folio, on an annotated baseMap) by
  // default. Derived from orderedBaseMaps, not from selectedBaseMapIds, so a
  // manual baseMap uncheck never re-checks its details.

  const detailIdsSignature = details.map((d) => d.id).join(",");

  useEffect(() => {
    if (!isDetailsPortfolio) return;
    const annotatedIds = new Set(
      orderedBaseMaps.map((item) => item.baseMap.id)
    );
    setSelectedIds(
      new Set(
        details
          .filter((d) => d.detailBaseMapId && annotatedIds.has(d.baseMapId))
          .map((d) => d.id)
      )
    );
  }, [isDetailsPortfolio, detailIdsSignature, baseMapIdsSignature]);

  // helpers

  const disabled = !name.trim();

  // handlers

  function handleToggleDetail(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleToggleBaseMap(baseMapId) {
    const wasSelected = selectedBaseMapIds.has(baseMapId);
    setSelectedBaseMapIds((prev) => {
      const next = new Set(prev);
      if (wasSelected) next.delete(baseMapId);
      else next.add(baseMapId);
      return next;
    });
    // unchecking a baseMap unchecks its details; checking it back re-checks
    // the ones with a folio
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const detail of details) {
        if (detail.baseMapId !== baseMapId) continue;
        if (wasSelected) next.delete(detail.id);
        else if (detail.detailBaseMapId) next.add(detail.id);
      }
      return next;
    });
  }

  function handleTitleBlockFieldChange(key, val) {
    setTitleBlockValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleCreate() {
    if (loading || disabled) return;
    setLoading(true);
    const orderedSelectedBaseMapIds = orderedBaseMaps
      .map((item) => item.baseMap.id)
      .filter((id) => selectedBaseMapIds.has(id));
    const selectedDetails = details.filter(
      (d) => selectedIds.has(d.id) && selectedBaseMapIds.has(d.baseMapId)
    );
    await onCreate({
      title: name.trim(),
      isDetailsPortfolio,
      selectedBaseMapIds: orderedSelectedBaseMapIds,
      selectedDetails,
      titleBlock: { key: titleBlockManifest.key, values: titleBlockValues },
    });
    setName("");
    setIsDetailsPortfolio(false);
    setLoading(false);
    onClose();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !disabled) {
      handleCreate();
    }
  }

  // render

  if (!open) return null;

  return (
    <DialogGeneric open={open} onClose={onClose} width="460px">
      <DialogTitle>{titleS}</DialogTitle>
      <BoxFlexVStretch>
        <Box sx={{ px: 1 }} onKeyDown={handleKeyDown}>
          <FieldTextV2
            label={labelS}
            value={name}
            onChange={(e) => setName(e)}
            options={{ fullWidth: true, showLabel: true, autoFocus: true }}
          />
        </Box>

        <Box sx={{ px: 1, pt: 1 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 1 }}
          >
            {titleBlockS}
          </Typography>
          <TitleBlockFieldsForm
            manifest={titleBlockManifest}
            values={titleBlockValues}
            onChange={handleTitleBlockFieldChange}
            placeholders={getTitleBlockPlaceholders(
              titleBlockManifest,
              dataMapping
            )}
          />
        </Box>

        <FieldCheck
          value={isDetailsPortfolio}
          onChange={setIsDetailsPortfolio}
          label={detailsPortfolioS}
          options={{ showAsInline: true }}
        />

        <Box sx={{ maxHeight: "40vh", overflow: "auto", px: 1 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 0.5 }}
          >
            {baseMapsS}
          </Typography>
          {orderedBaseMaps.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ p: 1, textAlign: "center" }}
            >
              {noBaseMapsS}
            </Typography>
          ) : (
            <List dense disablePadding>
              {orderedBaseMaps.map(({ baseMap, listingName }, index) => {
                const thumbnail = baseMap.getThumbnail?.();
                const count = countByBaseMapId[baseMap.id] ?? 0;
                const isFirstOfListing =
                  showListingHeaders &&
                  (index === 0 ||
                    orderedBaseMaps[index - 1].listingName !== listingName);
                return (
                  <Box key={baseMap.id}>
                    {isFirstOfListing && (
                      <ListSubheader disableSticky sx={{ lineHeight: 2 }}>
                        {listingName}
                      </ListSubheader>
                    )}
                    <ListItemButton
                      dense
                      onClick={() => handleToggleBaseMap(baseMap.id)}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Checkbox
                          edge="start"
                          size="small"
                          checked={selectedBaseMapIds.has(baseMap.id)}
                          tabIndex={-1}
                          disableRipple
                        />
                      </ListItemIcon>
                      {thumbnail ? (
                        <Box
                          component="img"
                          src={thumbnail}
                          alt=""
                          sx={thumbnailSx}
                        />
                      ) : (
                        <Box sx={placeholderSx} />
                      )}
                      <ListItemText
                        primary={baseMap.name}
                        secondary={`${count} ${
                          isDetailsPortfolio ? detailsS : annotationsS
                        }`}
                        primaryTypographyProps={{
                          variant: "body2",
                          noWrap: true,
                        }}
                        secondaryTypographyProps={{ variant: "caption" }}
                      />
                    </ListItemButton>
                  </Box>
                );
              })}
            </List>
          )}

          {isDetailsPortfolio && (
            <>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mt: 1, mb: 0.5 }}
              >
                {detailsSectionS}
              </Typography>
              {details.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ p: 1, textAlign: "center" }}
                >
                  {noDetailsS}
                </Typography>
              ) : (
                <List dense disablePadding>
                  {sortedDetails.map((detail) => {
                    const detailBaseMap = detail.detailBaseMapId
                      ? detailBaseMapById?.[detail.detailBaseMapId]
                      : null;
                    const hasFolio = Boolean(detailBaseMap);
                    const baseMapSelected = selectedBaseMapIds.has(
                      detail.baseMapId
                    );
                    const detailRef = getDetailRef(detail);
                    const secondary = !hasFolio
                      ? noFolioS
                      : !baseMapSelected
                        ? baseMapUncheckedS
                        : `${pageS} ${detailBaseMap.createdFrom?.pageNumber}`;
                    return (
                      <ListItemButton
                        key={detail.id}
                        dense
                        disabled={!hasFolio || !baseMapSelected}
                        onClick={() => handleToggleDetail(detail.id)}
                      >
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <Checkbox
                            edge="start"
                            size="small"
                            checked={
                              baseMapSelected && selectedIds.has(detail.id)
                            }
                            tabIndex={-1}
                            disableRipple
                          />
                        </ListItemIcon>
                        {detailBaseMap?.image?.thumbnail ? (
                          <Box
                            component="img"
                            src={detailBaseMap.image.thumbnail}
                            alt=""
                            sx={thumbnailSx}
                          />
                        ) : (
                          <Box sx={placeholderSx}>
                            <Typography variant="caption" fontWeight="bold">
                              {detailRef || "?"}
                            </Typography>
                          </Box>
                        )}
                        <ListItemText
                          primary={`${detailS} ${detailRef || ""}`.trim()}
                          secondary={secondary}
                          primaryTypographyProps={{ variant: "body2" }}
                          secondaryTypographyProps={{ variant: "caption" }}
                        />
                      </ListItemButton>
                    );
                  })}
                </List>
              )}
            </>
          )}
        </Box>
      </BoxFlexVStretch>
      <ButtonInPanelV2
        label={createS}
        onClick={handleCreate}
        variant="contained"
        loading={loading}
        disabled={disabled}
      />
    </DialogGeneric>
  );
}
