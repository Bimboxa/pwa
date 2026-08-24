import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setDetailBaseMapId, setDetailView } from "../baseMapEditorSlice";

import {
  Avatar,
  Box,
  IconButton,
  InputBase,
  Link,
  Typography,
} from "@mui/material";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldBaseMapOpacity from "Features/baseMaps/components/FieldBaseMapOpacity";
import FieldBaseMapOpacityIn3d from "Features/threedEditor/components/FieldBaseMapOpacityIn3d";

import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import db from "App/db/db";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";
import getBaseMapDisplayName from "Features/baseMaps/utils/getBaseMapDisplayName";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// ---------------------------------------------------------------------------
// PanelBaseMapDetailProperties — base map properties subview of the Fond de
// plan panel (#312): breadcrumb (Fonds de plan / <base map> / Propriétés),
// header with the base map identity, a "N versions · voir la liste" card
// navigating back to the versions subview, and the main property fields
// (name, active version label, opacity) — mirror of PanelTemplateProperties.
// ---------------------------------------------------------------------------

export default function PanelBaseMapDetailProperties({ baseMap, listing }) {
  const dispatch = useDispatch();

  // strings

  const breadcrumbRootS = "Fonds de plan";
  const breadcrumbSelfS = "Propriétés";
  const subtitleS = "Fond de plan";
  const seeListS = "voir la liste";
  const nameLabelS = "Fond de plan";
  const versionLabelS = "Version active";

  // data

  const updateEntity = useUpdateEntity();
  // The effective EDITOR key, not the module key: in 3D (T toggle) the
  // opacity slider drives the 3D scene display, not baseMap.opacity (same
  // rule as PanelBaseMapProperties).
  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);

  // state

  const [nameValue, setNameValue] = useState(null);
  const [versionLabelValue, setVersionLabelValue] = useState(null);

  // helpers

  const isThreedViewer = isThreedFamilyViewerKey(effectiveViewerKey);

  const baseMapListing = useMemo(() => {
    if (!listing) return undefined;
    return { ...listing, table: "baseMaps" };
  }, [listing]);

  const activeVersion = baseMap?.getActiveVersion?.();
  const imageSize = baseMap?.getActiveImageSize?.();

  const isEditingName = nameValue !== null;
  const displayName = isEditingName ? nameValue : baseMap?.name || "";

  const isEditingVersionLabel = versionLabelValue !== null;
  const displayVersionLabel = isEditingVersionLabel
    ? versionLabelValue
    : activeVersion?.label || "";

  const { label: displayNameS, isPlaceholder: isUnnamed } =
    getBaseMapDisplayName(baseMap);

  const versionsCount = baseMap.versions?.length || 1;
  const versionsCountS = `${versionsCount} version${
    versionsCount > 1 ? "s" : ""
  }`;

  const infoParts = [];
  if (imageSize?.width && imageSize?.height)
    infoParts.push(`r:${(imageSize.width / imageSize.height).toFixed(2)}`);
  const fileSizeS = stringifyFileSize(activeVersion?.image?.file?.size);
  if (fileSizeS) infoParts.push(fileSizeS);

  // handlers

  const handleBackToTree = () => {
    dispatch(setDetailBaseMapId(null));
  };

  const handleBackToVersions = () => {
    dispatch(setDetailView("VERSIONS"));
  };

  // handlers - baseMap name

  function handleNameFocus() {
    setNameValue(baseMap?.name || "");
  }

  async function handleNameBlur() {
    if (nameValue !== null && baseMap?.id) {
      await updateEntity(
        baseMap.id,
        { name: nameValue },
        { listing: baseMapListing }
      );
    }
    setNameValue(null);
  }

  function handleNameKeyDown(e) {
    if (e.key === "Enter") {
      e.target.blur();
    } else if (e.key === "Escape") {
      setNameValue(null);
    }
  }

  // handlers - version label

  function handleVersionLabelFocus() {
    setVersionLabelValue(activeVersion?.label || "");
  }

  async function handleVersionLabelBlur() {
    if (versionLabelValue !== null && activeVersion?.id) {
      await db.baseMapVersions.update(activeVersion.id, {
        label: versionLabelValue,
      });
    }
    setVersionLabelValue(null);
  }

  function handleVersionLabelKeyDown(e) {
    if (e.key === "Enter") {
      e.target.blur();
    } else if (e.key === "Escape") {
      setVersionLabelValue(null);
    }
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: 1,
        minHeight: 0,
      }}
    >
      {/* Breadcrumb */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          px: 2,
          pt: 1.5,
          pb: 1,
        }}
      >
        <Link
          component="button"
          underline="always"
          onClick={handleBackToTree}
          sx={{ color: "text.secondary", fontSize: "0.875rem" }}
        >
          {breadcrumbRootS}
        </Link>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          /
        </Typography>
        <Link
          component="button"
          underline="always"
          onClick={handleBackToVersions}
          sx={{
            color: "text.secondary",
            fontSize: "0.875rem",
            maxWidth: 120,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            ...(isUnnamed && { fontStyle: "italic" }),
          }}
        >
          {displayNameS}
        </Link>
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          /
        </Typography>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          {breadcrumbSelfS}
        </Typography>
      </Box>

      {/* Header: back + thumbnail + title */}
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 1.5, px: 1.5, pb: 1 }}
      >
        <IconButton
          onClick={handleBackToVersions}
          sx={{
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            flexShrink: 0,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <ChevronLeft sx={{ fontSize: 20 }} />
        </IconButton>
        <Avatar
          src={baseMap?.getThumbnail?.() || baseMap?.image?.thumbnail}
          variant="rounded"
          sx={{ width: 36, height: 36, flexShrink: 0 }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            noWrap
            sx={{
              display: "block",
              fontStyle: "italic",
              color: "text.secondary",
            }}
          >
            {subtitleS}
          </Typography>
          <Typography
            variant="h6"
            noWrap
            sx={{
              fontWeight: 700,
              ...(isUnnamed && {
                fontStyle: "italic",
                color: "text.secondary",
              }),
            }}
          >
            {displayNameS}
          </Typography>
        </Box>
      </Box>

      {/* Versions count card → versions subview */}
      <Box sx={{ px: 1.5, pb: 1 }}>
        <Box
          component="button"
          onClick={handleBackToVersions}
          sx={{
            width: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            px: 2,
            py: 1.25,
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "left",
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {versionsCountS}
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.25,
              color: "text.secondary",
            }}
          >
            <Typography variant="body2">{seeListS}</Typography>
            <ChevronRight sx={{ fontSize: 16 }} />
          </Box>
        </Box>
      </Box>

      {/* Property fields */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 1,
          p: 1.5,
        }}
      >
        <WhiteSectionGeneric>
          <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {nameLabelS}
              </Typography>
              <InputBase
                value={displayName}
                onChange={(e) => setNameValue(e.target.value)}
                onFocus={handleNameFocus}
                onBlur={handleNameBlur}
                onKeyDown={handleNameKeyDown}
                fullWidth
                sx={{ fontSize: "0.875rem" }}
              />
            </Box>
            {activeVersion && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {versionLabelS}
                </Typography>
                <InputBase
                  value={displayVersionLabel}
                  onChange={(e) => setVersionLabelValue(e.target.value)}
                  onFocus={handleVersionLabelFocus}
                  onBlur={handleVersionLabelBlur}
                  onKeyDown={handleVersionLabelKeyDown}
                  fullWidth
                  sx={{ fontSize: "0.875rem" }}
                />
              </Box>
            )}
            {infoParts.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                {infoParts.join(" — ")}
              </Typography>
            )}
          </Box>
        </WhiteSectionGeneric>

        <WhiteSectionGeneric>
          {/* In 3D, the slider/eye drive the 3D scene display (session-only),
              not baseMap.opacity (DB / 2D display). */}
          {isThreedViewer ? (
            <FieldBaseMapOpacityIn3d baseMap={baseMap} />
          ) : (
            <FieldBaseMapOpacity baseMap={baseMap} />
          )}
        </WhiteSectionGeneric>
      </Box>
    </Box>
  );
}
