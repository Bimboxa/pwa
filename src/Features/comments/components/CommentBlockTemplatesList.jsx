import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setSoloAnnotationTemplateId } from "Features/annotations/annotationsSlice";

import { selectHiddenAnnotationTemplateIdSet } from "Features/scopeVisibility/selectors/scopeVisibilitySelectors";

import { Box, ButtonBase, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import db from "App/db/db";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";

import { COMMENT_COLORS } from "../commentsDarkTheme";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useListings from "Features/listings/hooks/useListings";
import groupAnnotationTemplatesByGroupLabel from "Features/annotations/utils/groupAnnotationTemplatesByGroupLabel";
import sortAnnotationTemplatesByOrder from "Features/annotations/utils/sortAnnotationTemplatesByOrder";

// Sections of the list, in the display order of the annotations panel
// (PopperMapListings): listing after listing in the listings order, each
// listing's templates in their own order with their group headers. Templates
// of a listing that is not in the scope anymore come last.
function getSections(templates, listings) {
  const listingIds = (listings ?? []).map((l) => l.id);
  const known = new Set(listingIds);
  const buckets = [
    ...(listings ?? []).map((listing) => ({
      listing,
      templates: templates.filter((t) => t.listingId === listing.id),
    })),
    {
      listing: null,
      templates: templates.filter((t) => !known.has(t.listingId)),
    },
  ];
  return buckets
    .filter((bucket) => bucket.templates.length)
    .map((bucket) => ({
      listing: bucket.listing,
      items: groupAnnotationTemplatesByGroupLabel(
        sortAnnotationTemplatesByOrder(bucket.templates)
      ),
    }));
}

// TEMPLATES_LIST block of an info: annotation templates listed like the
// template rows of PopperMapListings (icon + label, group headers). A click
// on a row toggles the SOLO of that template (annotations.
// soloAnnotationTemplateId, the one of the popper rows): one solo at a time,
// a second click leaves it. The solo is a display state, so the rows stay
// active in the read-only contexts.
// `interactive: false` (the block previewed in the editor) keeps them inert.
export default function CommentBlockTemplatesList({
  block,
  interactive = true,
}) {
  const dispatch = useDispatch();

  // strings

  const missingS = "Modèles d'annotation introuvables";
  const soloS = "Solo";
  const exitSoloS = "Quitter le solo";

  // data

  const idsKey = (block.annotationTemplateIds ?? []).join(",");
  // undefined while loading
  const templates = useLiveQuery(async () => {
    const ids = idsKey ? idsKey.split(",") : [];
    if (!ids.length) return [];
    const rows = await db.annotationTemplates.bulkGet(ids);
    return rows.filter((row) => row && !row.deletedAt);
  }, [idsKey]);
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
  });
  const spriteImage = useAnnotationSpriteImage();
  const soloTemplateId = useSelector(
    (s) => s.annotations.soloAnnotationTemplateId
  );
  const hiddenTemplateIdSet = useSelector(selectHiddenAnnotationTemplateIdSet);

  // helpers

  const sections = useMemo(
    () => (templates ? getSections(templates, listings) : []),
    [templates, listings]
  );
  const showListingNames = sections.length > 1;

  // handlers

  function handleToggleSolo(templateId) {
    dispatch(
      setSoloAnnotationTemplateId(
        soloTemplateId === templateId ? null : templateId
      )
    );
  }

  // render

  if (!templates) return null;

  if (!templates.length) {
    return (
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {missingS}
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        borderRadius: 1.5,
        border: `1px solid ${COMMENT_COLORS.borderStrong}`,
        bgcolor: COMMENT_COLORS.surface,
        py: 0.5,
      }}
    >
      {sections.map((section, sectionIndex) => (
        <Box key={section.listing?.id ?? "other"}>
          {showListingNames && section.listing && (
            <Typography
              variant="caption"
              sx={{
                display: "block",
                px: 1.25,
                pt: sectionIndex === 0 ? 0.25 : 0.75,
                pb: 0.25,
                fontWeight: 600,
                color: COMMENT_COLORS.textSecondary,
              }}
            >
              {section.listing.name ?? section.listing.label}
            </Typography>
          )}
          {section.items.map((item, index) => {
            if (item.isGroupDivider) return null;
            if (item.isGroupHeader) {
              return (
                <Typography
                  key={`group-${index}`}
                  variant="caption"
                  sx={{
                    display: "block",
                    px: 1.25,
                    pt: 0.5,
                    fontSize: 10.5,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    color: COMMENT_COLORS.textSecondary,
                    opacity: 0.8,
                  }}
                >
                  {item.groupLabel}
                </Typography>
              );
            }
            const isSolo = soloTemplateId === item.id;
            const isHidden = hiddenTemplateIdSet.has(item.id);
            return (
              <Tooltip
                key={item.id}
                title={interactive ? (isSolo ? exitSoloS : soloS) : ""}
                arrow
                placement="left"
                disableInteractive
              >
                <ButtonBase
                  disabled={!interactive}
                  onClick={() => handleToggleSolo(item.id)}
                  sx={{
                    width: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    gap: 1,
                    px: 1.25,
                    py: 0.5,
                    textAlign: "left",
                    color: "text.primary",
                    bgcolor: isSolo
                      ? alpha(COMMENT_COLORS.accent, 0.3)
                      : "transparent",
                    boxShadow: isSolo
                      ? `inset 2px 0 0 ${COMMENT_COLORS.accentText}`
                      : "none",
                    transition: "background-color 0.12s",
                    "&:hover": {
                      bgcolor: isSolo
                        ? alpha(COMMENT_COLORS.accent, 0.4)
                        : COMMENT_COLORS.surfaceRaised,
                    },
                  }}
                >
                  <Box
                    sx={{
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 24,
                      height: 24,
                      opacity: isHidden ? 0.4 : 1,
                      filter: isHidden ? "grayscale(100%)" : "none",
                    }}
                  >
                    <AnnotationTemplateIcon
                      template={item}
                      size={18}
                      spriteImage={spriteImage}
                    />
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      overflowWrap: "anywhere",
                      fontWeight: isSolo ? 600 : 400,
                    }}
                  >
                    {item.label}
                  </Typography>
                </ButtonBase>
              </Tooltip>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}
