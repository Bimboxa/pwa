import { useState, useRef, useEffect, useCallback } from "react";

import cv from "Features/opencv/services/opencvService";

const LOUPE_SIZE = 200; // Taille écran de la loupe (doit correspondre à InteractionLayer)

/**
 * Hook qui gère l'état du dessin en cours (points, brush, cut) et les fonctions de commit.
 *
 * Responsabilités :
 * - drawingPoints : liste des points en cours de dessin (CLICK, ONE_CLICK, RECTANGLE, etc.)
 * - cutHostId : l'annotation hôte quand on dessine un CUT
 * - brushPath : chemin du pinceau en mode BRUSH
 * - commitPoint() : commit un point unique (mode ONE_CLICK)
 * - commitPolyline() : commit une polyligne, brush ou smart detect
 *
 * Pas d'impact ownership — le dessin crée toujours des annotations nouvelles,
 * attribuées à l'utilisateur courant par le hook Dexie dans db.js.
 */
export default function useDrawingCommit({
  enabledDrawingModeRef,
  onCommitDrawingRef,
  brushLayerRef,
  smartDetectRef,
  lastSmartROI,
}) {
  // --- drawing points ---

  const [drawingPoints, setDrawingPoints] = useState([]);
  const drawingPointsRef = useRef([]);
  useEffect(() => {
    drawingPointsRef.current = drawingPoints;
  }, [drawingPoints]);

  // --- cutHostId ---

  const [cutHostId, setCutHostId] = useState(null);
  const cutHostIdRef = useRef(null);
  useEffect(() => {
    cutHostIdRef.current = cutHostId;
  }, [cutHostId]);

  // --- brush path ---

  const [brushPath, setBrushPath] = useState([]);
  const brushPathRef = useRef([]);
  useEffect(() => {
    brushPathRef.current = brushPath;
  }, [brushPath]);

  // --- commitPoint ---

  const commitPoint = useCallback(() => {
    const pointsToSave = drawingPointsRef.current;
    if (pointsToSave.length === 1) {
      console.log("COMMIT POINT", pointsToSave);
      performance.mark("marker-commit-start");
      onCommitDrawingRef.current({ points: pointsToSave });
    } else {
      console.log("⚠️ erreur création d'un point.");
    }

    // Nettoyage
    setDrawingPoints([]);
  }, [onCommitDrawingRef]);

  // --- commitPolyline ---

  const commitPolyline = useCallback(async (event, options) => {
    const drawingMode = enabledDrawingModeRef.current;

    // --- CAS BRUSH ---
    if (drawingMode === "BRUSH") {
      if (brushPathRef.current.length === 0) return;

      console.log("Processing Brush Drawing...");

      // 1. Snapshot du Canvas
      const dataUrl = brushLayerRef.current?.getSnapshotDataUrl();
      if (!dataUrl) return;

      // 2. Appel OpenCV
      await cv.load();
      const polygons = await cv.extractPolygonsFromMaskAsync({
        maskDataUrl: dataUrl,
        simplificationFactor: 3.0,
      });

      // 3. Commit pour chaque polygone trouvé
      console.log("[BRUSH] Polygons found:", polygons);
      if (polygons && polygons.length > 0) {
        polygons.forEach((points) => {
          if (onCommitDrawingRef.current)
            onCommitDrawingRef.current({ points, options });
        });
      }

      // 4. Reset
      setBrushPath([]);
      return;
    }

    // --- CAS SMART_DETECT ---
    if (drawingMode === "SMART_DETECT") {
      const localPolylines = smartDetectRef.current?.getDetectedPolylines();
      const roiData = lastSmartROI.current;

      console.log("[SMART_DETECT] Local Polylines:", localPolylines);
      if (localPolylines && roiData) {
        const ratio = roiData.width / LOUPE_SIZE;

        localPolylines.forEach((localPolyline) => {
          const points = localPolyline.points.map((p) => ({
            x: roiData.x + p.x * ratio,
            y: roiData.y + p.y * ratio,
          }));
          if (onCommitDrawingRef.current)
            onCommitDrawingRef.current({ points });
        });
      }
      return;
    }

    // --- CAS CLICK/POLYLINE (Défaut) ---

    const pointsToSave = drawingPointsRef.current;
    const _cutHostId = cutHostIdRef.current;
    if (pointsToSave.length >= 2) {
      onCommitDrawingRef.current({
        points: pointsToSave,
        event,
        cutHostId: _cutHostId,
        options,
      });
    } else {
      console.log("⚠️ Pas assez de points pour créer une polyligne");
    }

    // Nettoyage
    setDrawingPoints([]);
    setCutHostId(null);
  }, [
    enabledDrawingModeRef,
    onCommitDrawingRef,
    brushLayerRef,
    smartDetectRef,
    lastSmartROI,
  ]);

  return {
    drawingPoints,
    setDrawingPoints,
    drawingPointsRef,
    cutHostId,
    setCutHostId,
    brushPath,
    setBrushPath,
    commitPoint,
    commitPolyline,
  };
}
