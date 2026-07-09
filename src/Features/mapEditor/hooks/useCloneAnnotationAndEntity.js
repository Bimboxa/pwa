import { nanoid } from "@reduxjs/toolkit";
import { useSelector } from "react-redux";
import useMainBaseMap from "./useMainBaseMap";

import useCreateAnnotation from "Features/annotations/hooks/useCreateAnnotation";
import useCreateEntity from "Features/entities/hooks/useCreateEntity";

import getPolygonsPointsFromStripAnnotation from "Features/annotations/utils/getPolygonsPointsFromStripAnnotation";
import applyStripElevation, {
  getStripElevationOffsetZ,
} from "Features/annotations/utils/applyStripElevation";
import duplicateAnnotationPoints from "Features/annotations/utils/duplicateAnnotationPoints";

import db from "App/db/db";

// Compute signed area to determine polygon winding order.
// Positive = counter-clockwise, negative = clockwise.
function getSignedArea(points) {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return area / 2;
}

export default function useCloneAnnotationAndEntity() {

    const createAnnotation = useCreateAnnotation();
    const createEntity = useCreateEntity();
    const baseMap = useMainBaseMap()

    const _newAnnotation = useSelector((state) => state.annotations.newAnnotation);
    const activeLayerId = useSelector((s) => s.layers?.activeLayerId);

    return async (annotation, options) => {
        // options
        const entityLabel = options?.entityLabel;
        const part = options?.part;
        const stripElevation = options?.stripElevation;
        // Default true = reuse source point refs (legacy behavior). false = mint
        // brand-new db.points so the duplicate is fully independent.
        const keepOriginalPoints = options?.keepOriginalPoints ?? true;
        const imageSize = baseMap?.getImageSize?.() ?? baseMap?.image?.imageSize;
        let newAnnotation = options?.newAnnotation;

        if (!newAnnotation) newAnnotation = _newAnnotation;

        console.log("CLONE with newAnnotation", newAnnotation, _newAnnotation, "part=", part?.kind)

        // 0. Part-based clone: when a sub-part of the annotation is selected
        // we ignore the host's points/cuts and use the part geometry directly.
        // - SEGMENT(S) / CUT_SEG / GUIDE → open polyline of the part's pointRefs
        // - CUT → closed polygon of the cut's pointRefs (host keeps its cut)
        const hasPart = part && part.kind && part.kind !== "NONE";

        // 1. Identify Logic: Are we splitting a Polygon with cuts into Polylines?
        const isPolygonToPolyline =
            !hasPart &&
            annotation.type === "POLYGON" && newAnnotation.type === "POLYLINE";
        const hasCuts = Array.isArray(annotation.cuts) && annotation.cuts.length > 0;
        const shouldSplitIntoMultiple = isPolygonToPolyline && hasCuts;

        const isStripToPolygon =
            !hasPart &&
            annotation.type === "STRIP" && newAnnotation.type === "POLYGON";

        const isToStrip = newAnnotation.type === "STRIP" && annotation.type !== "STRIP";

        // 2. Prepare the list of items (geometry sets) to create
        // Each item contains { points: [], cuts: [] }
        const itemsToCreate = [];

        if (hasPart) {
            // Batch mode: a non-contiguous multi-segment selection arrives as
            // `part.chains` — one chain per group of contiguous segments. Create
            // one polyline annotation per chain. Each chain may carry
            // `closesRing: true` when it covers an entire closed ring; the
            // resulting polyline gets closeLine=true so the wraparound segment
            // (last point → first point) is preserved.
            if (part.kind === "SEGMENTS" && Array.isArray(part.chains) && part.chains.length > 0) {
                for (const chain of part.chains) {
                    const refs = chain?.pointRefs || [];
                    if (refs.length < 2) continue;
                    itemsToCreate.push({
                        points: refs,
                        cuts: [],
                        closesRing: !!chain.closesRing,
                    });
                }
                if (itemsToCreate.length === 0) {
                    console.warn("[clone] no usable chain in part.chains", part);
                    return null;
                }
            } else {
                const pointRefs = Array.isArray(part.pointRefs) ? part.pointRefs : [];
                const minPoints = part.kind === "CUT" ? 3 : 2;
                if (pointRefs.length < minPoints) {
                    console.warn("[clone] part has too few points, aborting", part);
                    return null;
                }
                itemsToCreate.push({ points: pointRefs, cuts: [] });
            }
        }

        else if (shouldSplitIntoMultiple) {
            // A. Main Contour -> Becomes 1 independent Polyline
            itemsToCreate.push({
                points: annotation.points,
                cuts: [], // Polylines don't have cuts
            });

            // B. Each Cut -> Becomes 1 independent Polyline
            annotation.cuts.forEach((cut) => {
                if (cut.points && cut.points.length > 0) {
                    itemsToCreate.push({
                        points: cut.points,
                        cuts: [],
                    });
                }
            });
        }

        else if (isStripToPolygon) {
            const polygonsPoints = getPolygonsPointsFromStripAnnotation(annotation, baseMap.meterByPx);
            polygonsPoints.forEach((points) => {
                itemsToCreate.push({
                    points,
                    cuts: [],
                });
            });
        }

        else {
            // Standard Clone (1 to 1)
            // We preserve the cuts if we are not splitting
            itemsToCreate.push({
                points: annotation.points,
                cuts: annotation.cuts,
            });
        }

        // 3. Execution Loop
        const createdAnnotations = [];

        for (const item of itemsToCreate) {
            // A. Create a NEW unique entity for THIS specific geometry
            const entity = await createEntity({
                label: entityLabel,
                listingId: newAnnotation.listingId || annotation.listingId,
                projectId: annotation.projectId,
            });

            // B. Create the Annotation
            const clonedAnnotation = {
                ...annotation,
                ...newAnnotation, // Apply new type/styles from store
                id: nanoid(),
                entityId: entity?.id, // Link to the newly created entity
                points: item.points,
                cuts: item.cuts,
                ...(activeLayerId ? { layerId: activeLayerId } : {}),
            };

            // Part clones inherit the host's styles/template but must drop
            // host-only ring metadata that doesn't belong to the slice we kept.
            if (hasPart) {
                delete clonedAnnotation.guideLines;
                delete clonedAnnotation.innerPoints;
                delete clonedAnnotation.hiddenSegmentsIdx;
                delete clonedAnnotation.isoHeightSegmentsIdx;
                delete clonedAnnotation.isExtEdgeSegmentsIdx;
                // Open vs closed line:
                //   CUT → closed polygon (or polyline-with-closeLine)
                //   SEGMENTS chain with closesRing → closed polyline
                //   other SEGMENT(S) / CUT_SEG / GUIDE → open polyline
                if (part.kind === "CUT") {
                    clonedAnnotation.closeLine = true;
                } else if (clonedAnnotation.type === "POLYLINE") {
                    clonedAnnotation.closeLine = item.closesRing === true;
                }
            }

            // Ensure lines are closed if converting from Polygon to Polyline
            if (isPolygonToPolyline || isStripToPolygon) {
                clonedAnnotation.closeLine = true;
            }

            // Handle conversion to STRIP
            if (isToStrip) {
                clonedAnnotation.stripOrientation = 1; // default
                // For polygon/closed-line → strip, orient band inside
                if (annotation.type === "POLYGON" || annotation.closeLine) {
                    clonedAnnotation.closeLine = true;
                    const signedArea = getSignedArea(item.points);
                    // CCW (positive area) → left side is inside → orientation 1
                    // CW (negative area) → right side is inside → orientation -1
                    clonedAnnotation.stripOrientation = signedArea >= 0 ? 1 : -1;
                }
            }

            // Place the band's 3D surface at the TOP or BOTTOM of the source
            // wall. Full clone only (part clones lack per-point offsets). Runs
            // after the ...newAnnotation spread so the source wall's offsetZ
            // overrides the template's.
            if (
                isToStrip &&
                !hasPart &&
                annotation.type === "POLYLINE" &&
                (stripElevation === "TOP" || stripElevation === "BOTTOM")
            ) {
                clonedAnnotation.offsetZ = getStripElevationOffsetZ(
                    annotation,
                    stripElevation
                );
                clonedAnnotation.points = applyStripElevation(
                    item.points,
                    stripElevation,
                    annotation
                );
            }

            // Create independent points unless the caller opted to keep
            // originals. Write points BEFORE the annotation so they resolve on
            // the next read; point writes don't add annotationsUpdate triggers.
            let annotationToCreate = clonedAnnotation;
            if (!keepOriginalPoints) {
                const { annotation: remapped, pointRecords } =
                    duplicateAnnotationPoints(clonedAnnotation, {
                        imageSize,
                        projectId: annotation.projectId,
                        baseMapId: annotation.baseMapId,
                        listingId: annotation.listingId,
                    });
                annotationToCreate = remapped;
                if (pointRecords.length > 0) {
                    await db.points.bulkAdd(pointRecords);
                }
            }

            const _annotation = await createAnnotation(annotationToCreate);
            createdAnnotations.push(_annotation);
        }

        // Return single object if only one created (backward compatibility), else return array
        return createdAnnotations.length === 1
            ? createdAnnotations[0]
            : createdAnnotations;
    };
}
