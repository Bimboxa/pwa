import { nanoid } from "@reduxjs/toolkit";
import polygonClipping from "polygon-clipping";

import collapseArcsInPolyline from "./collapseArcsInPolyline";
import {
    expandArcsInPath,
    extractArcCircles,
    arcUnitsToTypedPoints,
} from "./arcSampling";

const ARC_SAMPLES = 12; // chords per arc half when polygonizing before the union

const round3 = (v) => parseFloat(v.toFixed(3));
const keyOf = (x, y) => `${x.toFixed(3)}_${y.toFixed(3)}`;

// Build the union input for one polygon: an arc-expanded GeoJSON polygon
// (polygon-clipping is straight-line only) plus a lookup from rounded pixel
// coords to the ORIGINAL point objects (which carry `id` + `type`), so the
// result can reuse those ids and keep arc typing. Expanding the arcs before the
// union is what stops a circle (stored as S-C-S points) from being treated as
// the bare 4-vertex square inscribed in it.
function buildMergeInput(polygon) {
    const pointByXY = {};
    const register = (pts) => {
        for (const p of pts) pointByXY[keyOf(p.x, p.y)] = p;
    };
    const toRing = (pts) => {
        const expanded = expandArcsInPath(pts, ARC_SAMPLES, true);
        const ring = expanded.map((p) => [round3(p.x), round3(p.y)]);
        // GeoJSON rings must be closed (last point = first point).
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            ring.push([first[0], first[1]]);
        }
        return ring;
    };

    register(polygon.points);
    const rings = [toRing(polygon.points)];
    for (const cut of polygon.cuts ?? []) {
        if (cut?.points && cut.points.length >= 3) {
            register(cut.points);
            rings.push(toRing(cut.points));
        }
    }
    return { geoJson: rings, pointByXY };
}

export default function mergeTwoPolygons(polygonA, polygonB) {
    if (!polygonA?.points || !polygonB?.points) return null;

    // Remember every source arc circle (both polygons, outer ring + cuts) so a
    // curve that survives the union is recovered as a clean S-C-S arc instead of
    // the dense faceted ring polygon-clipping emits. Same mechanism as
    // applyOpeningOnPolygon. Without this, a circle merged with a rectangle would
    // degrade into the 4-vertex square inscribed in the circle.
    const sourceArcCircles = [
        ...extractArcCircles(polygonA.points),
        ...(polygonA.cuts ?? []).flatMap((c) => extractArcCircles(c.points ?? [])),
        ...extractArcCircles(polygonB.points),
        ...(polygonB.cuts ?? []).flatMap((c) => extractArcCircles(c.points ?? [])),
    ];

    const inputA = buildMergeInput(polygonA);
    const inputB = buildMergeInput(polygonB);

    // L'union calcule automatiquement les nouveaux contours et les trous créés.
    const union = polygonClipping.union(inputA.geoJson, inputB.geoJson);

    // Si l'union donne plus d'un polygone, ils ne sont pas connectés.
    if (union.length !== 1) {
        return null;
    }

    const resultPolygon = union[0]; // [[outer], [hole1], [hole2], ...]
    const pointByXY = { ...inputA.pointByXY, ...inputB.pointByXY };
    const newPoints = [];

    // Recover arcs from a (closed) result ring, then map each typed vertex back
    // to an existing point (reusing its id) or mint a new one. Arc midpoints are
    // always freshly computed, so they become new points.
    const mapRingToPoints = (ring) => {
        // En GeoJSON le dernier point répète le premier : on le retire.
        const ptsPx = ring.slice(0, -1).map(([x, y]) => ({ x, y }));
        if (ptsPx.length === 0) return [];

        let typed;
        if (sourceArcCircles.length === 0) {
            typed = ptsPx.map((p) => ({ x: p.x, y: p.y, type: "square" }));
        } else {
            // Each ring is a closed loop scanned as a polyline, so an arc that
            // straddles the (arbitrary) ring seam stays faceted — acceptable for
            // merged contours, matching applyOpeningOnPolygon.
            const units = collapseArcsInPolyline(ptsPx, {
                sourceArcCircles,
                requireSourceMatch: true,
            });
            typed = arcUnitsToTypedPoints(units);
        }

        return typed.map((tp) => {
            const key = keyOf(tp.x, tp.y);
            const existing = pointByXY[key];
            if (existing) {
                // Reuse the original point (keeps its id). Promote it to a circle
                // control point if the recovered arc says so.
                if (tp.type === "circle" && existing.type !== "circle") {
                    return { ...existing, type: "circle" };
                }
                return existing;
            }
            const minted = { x: round3(tp.x), y: round3(tp.y), id: nanoid() };
            if (tp.type === "circle") minted.type = "circle";
            newPoints.push(minted);
            // Évite de créer 2 ids si le même point réapparaît dans un autre anneau.
            pointByXY[key] = minted;
            return minted;
        });
    };

    const mergedMainPoints = mapRingToPoints(resultPolygon[0]);
    const mergedCuts = resultPolygon.slice(1).map((holeRing) => ({
        id: nanoid(),
        points: mapRingToPoints(holeRing),
    }));

    return {
        mergedPolygon: {
            points: mergedMainPoints,
            cuts: mergedCuts,
        },
        newPoints,
    };
}
