// Shared UI-side constants of the photoPlan calibration flows (Élévation
// panel + quick-flatten section of the Transfo. tool).

// Default vanishing-line segments (normalized): 2 quasi-horizontal for the U
// family, 2 quasi-vertical for the V family. The user only drags endpoints —
// there is no drawing mode.
export const defaultVanishingLines = () => ({
  u: [
    { id: "u1", p1: { x: 0.2, y: 0.35 }, p2: { x: 0.8, y: 0.35 } },
    { id: "u2", p1: { x: 0.2, y: 0.65 }, p2: { x: 0.8, y: 0.65 } },
  ],
  v: [
    { id: "v1", p1: { x: 0.35, y: 0.2 }, p2: { x: 0.35, y: 0.8 } },
    { id: "v2", p1: { x: 0.65, y: 0.2 }, p2: { x: 0.65, y: 0.8 } },
  ],
});

export const linesEqualDefaults = (lines) => {
  const d = defaultVanishingLines();
  const eq = (a, b) =>
    a.length === b.length &&
    a.every(
      (s, i) =>
        s.p1.x === b[i].p1.x &&
        s.p1.y === b[i].p1.y &&
        s.p2.x === b[i].p2.x &&
        s.p2.y === b[i].p2.y
    );
  return eq(lines.u ?? [], d.u) && eq(lines.v ?? [], d.v);
};

export const CALIBRATION_ERROR_MESSAGES = {
  VP_U_DEGENERATE:
    "Lignes de fuite U (bleues) inexploitables : 2 segments non alignés requis.",
  VP_V_DEGENERATE:
    "Lignes de fuite V (oranges) inexploitables : 2 segments non alignés requis.",
  NEEDS_FOCAL:
    "Photo prise à niveau (lignes V parallèles) : renseignez la focale équiv. 35 mm ci-dessous, ou inclinez la prise de vue.",
  FOCAL_DEGENERATE:
    "Points de fuite incohérents avec deux directions perpendiculaires — ajustez les lignes de fuite.",
  VPS_TOO_CLOSE:
    "Les deux familles de lignes convergent vers le même point — directions trop proches.",
  TARGETS_SUPERIMPOSED:
    "Les pastilles doivent être distinctes sur la vue en plan.",
  PHOTO_TARGETS_SUPERIMPOSED:
    "Les pastilles doivent être distinctes sur la photo.",
  TARGETS_SAME_U:
    "Les deux pastilles sont à la même abscisse sur le plan — écartez-les horizontalement.",
  TARGET_ON_HORIZON: "Une pastille est sur la ligne d'horizon — déplacez-la.",
  REF_HEIGHT_REQUIRED: "Saisissez la hauteur du point de référence.",
  COTE_LENGTH_REQUIRED: "Saisissez la longueur réelle de la cote connue.",
  COTE_DEGENERATE:
    "Les extrémités de la cote connue sont confondues — écartez-les.",
  COTE_ON_HORIZON:
    "Une extrémité de la cote connue est sur la ligne d'horizon — déplacez-la.",
};
