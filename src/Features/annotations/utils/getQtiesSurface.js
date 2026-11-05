// Surface (m²) to DISPLAY for annotation quantities (getAnnotationQties):
// the developed surface when there is one — sloped top face, stairs, every
// face of a prism (POLYGON with a height) — else the planar footprint.
export default function getQtiesSurface(qties) {
  return qties?.surfaceDeveloped ?? qties?.surface;
}
