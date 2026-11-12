// components/MapTooltip.jsx
import { forwardRef } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";
import { Paper, Typography, Box } from "@mui/material";

import db from "App/db/db";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useBaseMap from "Features/baseMaps/hooks/useBaseMap";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import getAnnotationQties from "Features/annotations/utils/getAnnotationQties";
import useAnnotationTaskHours from "Features/businessObjects/hooks/useAnnotationTaskHours";
import useAnnotationLinkedBusinessObjectRows from "Features/businessObjects/hooks/useAnnotationLinkedBusinessObjectRows";
import { formatHours } from "Features/businessObjects/utils/hoursRatioConversions";
import { CUT_LINE_LABEL } from "Features/threedCutLines/constants/cutLineStyle";

// The tooltip always shows the annotation's own totals. The hovered PART (3D
// editor) is added BELOW them, under a divider:
// qtiesOverride ({ length?, surface? }): quantities of the hovered face / edge
// of a mesh annotation; qtiesOverrideType ("FACE" | "EDGE") names that part
// (the length of a face is its perimeter).
// faceQties ({ surface?, perimeter? }): quantities of the hovered FACE of a
// regular annotation with several faces.
const QTIES_OVERRIDE_LABELS = {
  FACE: "Quantités de la face",
  EDGE: "Quantités de l'arête",
};

// One quantity line: grey label on the left, value + unit on the right.
function QtyRow({ label, value, unit }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
      <Typography variant="caption" sx={{ color: "grey.500" }}>
        {label}
      </Typography>
      <Typography
        variant="caption"
        sx={{ fontFamily: "monospace", color: "warning.main", fontWeight: 500 }}
      >
        {value.toFixed(2)} {unit}
      </Typography>
    </Box>
  );
}

const MapTooltip = forwardRef(
  (
    {
      hoveredNode,
      annotations,
      x,
      y,
      isSelected,
      qtiesOverride,
      qtiesOverrideType,
      faceQties,
    },
    ref
  ) => {
    // data

    const baseMap = useMainBaseMap();
    const spriteImage = useAnnotationSpriteImage();

    // helper - annotations

    const annotation = annotations.find((a) => a.id === hoveredNode?.nodeId);

    // data - detail baseMap (DETAIL annotations link a detail baseMap whose
    // record carries the inline page thumbnail)

    const detailBaseMapId =
      annotation?.type === "DETAIL" ? annotation?.detailBaseMapId : null;
    const detailBaseMap = useLiveQuery(
      async () => (detailBaseMapId ? db.baseMaps.get(detailBaseMapId) : null),
      [detailBaseMapId]
    );

    // data - listing name (annotations carry listingId only)
    const listingName = useSelector((s) =>
      annotation?.listingId
        ? (s.listings.listingsById?.[annotation.listingId]?.name ?? null)
        : null
    );

    // helper - template label (a cut line has no template: its type name)
    const templateLabel =
      annotation?.annotationTemplateProps?.label ||
      annotation?.templateLabel ||
      (annotation?.type === "CUT_LINE" ? CUT_LINE_LABEL : undefined);

    // helper - annotation label (entity label when entity-linked, else own label)
    const annotationLabel =
      annotation?.label && annotation.label !== templateLabel
        ? annotation.label
        : null;

    // data - the annotation's own base map, when it is not the main one (3D
    // scene showing several base maps, Maillage module without a main base
    // map): the quantities need ITS scale.
    const ownBaseMapId =
      annotation?.baseMapId && annotation.baseMapId !== baseMap?.id
        ? annotation.baseMapId
        : null;
    const ownBaseMap = useBaseMap({ id: ownBaseMapId });
    const meterByPx = ownBaseMapId ? ownBaseMap?.meterByPx : baseMap?.meterByPx;

    // helper - qties (the annotations prop carries no .qties — parents resolve
    // without withQties — so compute for the single hovered annotation)
    const qties = annotation
      ? getAnnotationQties({ annotation, meterByPx })
      : null;
    const length =
      qties?.lengthDeveloped != null ? qties.lengthDeveloped : qties?.length;
    const surface =
      qties?.surfaceDeveloped != null ? qties.surfaceDeveloped : qties?.surface;
    const showLength = Boolean(qties?.enabled) && length > 0;
    const showSurface = Boolean(qties?.enabled) && surface > 0;
    const layoutLength = qties?.layoutLength;
    const showLayoutLength = Boolean(qties?.enabled) && layoutLength > 0;

    // helper - hovered part (3D): a face / edge of a mesh annotation
    // (qtiesOverride) or a face of a regular annotation (faceQties)
    const isEdgePart = Boolean(qtiesOverride) && qtiesOverrideType === "EDGE";
    const partLabel = isEdgePart
      ? QTIES_OVERRIDE_LABELS.EDGE
      : QTIES_OVERRIDE_LABELS.FACE;
    const partSurface = isEdgePart
      ? null
      : (qtiesOverride?.surface ?? faceQties?.surface);
    const partPerimeter = isEdgePart
      ? null
      : (qtiesOverride?.length ?? faceQties?.perimeter);
    const partLength = isEdgePart ? qtiesOverride.length : null;
    const showPartSurface = partSurface > 0;
    const showPartPerimeter = partPerimeter > 0;
    const showPartLength = partLength > 0;

    // helper - height (effective annotation height in meters: the template
    // value when locked, else the annotation's own; hidden when absent or 0)
    const height = Number(annotation?.height);
    const showHeight = Number.isFinite(height) && height > 0;

    // helper - business objects (quantities) this annotation feeds, every
    // module: one line each, number + label + its quantity in the object's
    // unit
    const linkedObjectRows = useAnnotationLinkedBusinessObjectRows({
      annotation,
      qties,
    });

    // helper - PLANNING module: hours this annotation represents for each
    // applicable task of the active listing (empty everywhere else)
    const {
      tasks: taskHours,
      workPackage,
      total: taskHoursTotal,
    } = useAnnotationTaskHours({
      annotation,
      qties,
    });

    // helper - image
    const entity = annotation?.entity;
    const imageUrl_entity = entity?.image?.imageUrlClient;
    const imageUrl_0 =
      annotation?.images?.[0]?.imageUrlClient ||
      annotation?.images?.[0]?.imageUrlRemote;
    const imageUrl = imageUrl_entity || imageUrl_0;
    const hasImage = Boolean(imageUrl);

    // helper - folio (DETAIL annotations linked to a PDF page)
    const folioThumbnail =
      annotation?.type === "DETAIL" && !isSelected
        ? detailBaseMap?.image?.thumbnail
        : null;

    // helper - photo (PHOTO pseudo-annotations carry an inline thumbnail)
    const photoThumbnail =
      annotation?.type === "PHOTO" ? annotation?.thumbnail : null;

    // helper - position (controlled mode when x/y are passed)
    const isControlled = typeof x === "number" && typeof y === "number";

    // render

    if (!hoveredNode) return null;
    if (!annotation) return null;
    if (annotation.type === "IMAGE") return null;

    return (
      <Paper
        ref={ref}
        elevation={4}
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          // In controlled mode the parent passes x/y as props; otherwise
          // the parent updates `transform` imperatively via the ref.
          ...(isControlled && { transform: `translate(${x}px, ${y}px)` }),
          // Important: pointerEvents: none lets the mouse click "through" the tooltip
          pointerEvents: "none",
          zIndex: 9999,
          padding: 1,
          maxWidth: 200,
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          color: "white",
          borderRadius: 1,
          willChange: "transform",
        }}
      >
        {/* Photo preview (PHOTO pseudo-annotations, Photos module) */}
        {photoThumbnail && (
          <Box
            component="img"
            src={photoThumbnail}
            alt={annotation.name ?? "Photo"}
            sx={{
              width: "100%",
              objectFit: "cover",
              borderRadius: 0.5,
              mb: 0.5,
            }}
          />
        )}
        {/* Folio page preview (DETAIL annotations, hidden when selected) */}
        {folioThumbnail && (
          <Box
            component="img"
            src={folioThumbnail}
            alt="Folio page"
            sx={{
              width: "100%",
              objectFit: "contain",
              bgcolor: "white",
              borderRadius: 0.5,
              mb: 0.5,
            }}
          />
        )}
        {/* Image (only if exists) */}
        {hasImage && (
          <Box
            component="img"
            src={imageUrl}
            alt="Entity image"
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}
        {/* Listing the annotation belongs to */}
        {listingName && (
          <Typography
            variant="caption"
            noWrap
            sx={{ display: "block", color: "grey.500" }}
          >
            {listingName}
          </Typography>
        )}
        {/* Template (icon + label). The icon reads the merged annotation:
                it carries exactly the colors / fillType the 2D & 3D renderers
                use (template value when locked, own value otherwise). Never
                `annotation.annotationTemplate`: a stale copy of the source
                template that the clone flow used to persist on the row. */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <AnnotationTemplateIcon
            template={annotation}
            size={16}
            spriteImage={spriteImage}
          />
          {templateLabel && (
            <Typography
              variant="caption"
              sx={{ fontWeight: "bold", color: "#90caf9" }}
            >
              {templateLabel}
            </Typography>
          )}
        </Box>
        {annotationLabel && (
          <Typography variant="caption" sx={{ display: "block" }}>
            {annotationLabel}
          </Typography>
        )}
        {showHeight && <QtyRow label="Hauteur" value={height} unit="m" />}
        {/* Qties (length & surface, zero values hidden) */}
        {showLength && <QtyRow label="Longueur" value={length} unit="ml" />}
        {showSurface && <QtyRow label="Surface" value={surface} unit="m²" />}
        {showLayoutLength && (
          <QtyRow label="Calepinage" value={layoutLength} unit="ml" />
        )}
        {/* Hovered part (3D): face / edge, below the annotation totals */}
        {(showPartSurface || showPartPerimeter || showPartLength) && (
          <Box
            sx={{
              mt: 0.75,
              pt: 0.5,
              borderTop: "1px solid",
              borderColor: "rgba(255,255,255,0.2)",
            }}
          >
            <Typography
              variant="caption"
              sx={{ display: "block", color: "grey.400", fontStyle: "italic" }}
            >
              {partLabel}
            </Typography>
            {showPartLength && (
              <QtyRow label="Longueur" value={partLength} unit="ml" />
            )}
            {showPartSurface && (
              <QtyRow label="Surface" value={partSurface} unit="m²" />
            )}
            {showPartPerimeter && (
              <QtyRow label="Périmètre" value={partPerimeter} unit="ml" />
            )}
          </Box>
        )}
        {/* PLANNING module: the tasks ("postes") this annotation feeds,
                with its own share of hours (qty × ratio), under its task
                (work package). Nothing at all when the annotation belongs to
                no work package. */}
        {taskHours.length > 0 && (
          <Box
            sx={{
              mt: 0.75,
              pt: 0.5,
              borderTop: "1px solid",
              borderColor: "rgba(255,255,255,0.2)",
            }}
          >
            <Box
              sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}
            >
              <Typography
                variant="caption"
                noWrap
                sx={{ color: "grey.500", minWidth: 0 }}
              >
                {workPackage?.label}
              </Typography>
              {taskHoursTotal != null && (
                <Typography
                  variant="caption"
                  sx={{ fontFamily: "monospace", fontWeight: 600 }}
                >
                  {formatHours(taskHoursTotal)}
                </Typography>
              )}
            </Box>
            {taskHours.map((task) => (
              <Box
                key={task.id}
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 1,
                }}
              >
                <Typography variant="caption" noWrap sx={{ minWidth: 0 }}>
                  {task.label}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: "monospace",
                    color: task.hours != null ? "success.light" : "grey.500",
                    whiteSpace: "nowrap",
                  }}
                >
                  {task.hours != null
                    ? formatHours(task.hours, { withDays: false })
                    : "sans ratio"}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
        {/* Business objects (quantities) the annotation feeds: number,
                label, its quantity in the object's unit — under a divider */}
        {linkedObjectRows.length > 0 && (
          <Box
            sx={{
              mt: 0.75,
              pt: 0.5,
              borderTop: "1px solid",
              borderColor: "rgba(255,255,255,0.2)",
            }}
          >
            {linkedObjectRows.map((row) => (
              <Box
                key={row.id}
                sx={{ display: "flex", alignItems: "baseline", gap: 1 }}
              >
                {row.number && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: "monospace",
                      color: "grey.500",
                      flexShrink: 0,
                    }}
                  >
                    {row.number}
                  </Typography>
                )}
                <Typography
                  variant="caption"
                  noWrap
                  sx={{ flex: 1, minWidth: 0 }}
                >
                  {row.label}
                </Typography>
                {row.qtyLabel && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: "monospace",
                      color: "warning.main",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.qtyLabel}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Paper>
    );
  }
);

export default MapTooltip;
