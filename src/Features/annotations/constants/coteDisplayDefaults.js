// Single source of truth for how a measured length is displayed on COTE and
// RULER annotations (2D, 3D, drawing preview, template editor). Both shapes
// share the same default: meters with 2 decimals ("1.45 m").

export const DEFAULT_COTE_UNIT = "M";
export const DEFAULT_COTE_DECIMALS = 2;

export const UNIT_FACTORS_FROM_METERS = { MM: 1000, CM: 100, M: 1 };
export const UNIT_SUFFIXES = { MM: "mm", CM: "cm", M: "m" };

// Display style of a COTE annotation (`coteStyle`):
// - STANDARD: the value alone, written along the dimension line;
// - LABEL ("Étiquette"): "<label> = <value>", always horizontal, tied to the
//   dimension line by a small leader (see getCoteLabelStyleGeometry).
export const COTE_STYLE_STANDARD = "STANDARD";
export const COTE_STYLE_LABEL = "LABEL";
export const DEFAULT_COTE_STYLE = COTE_STYLE_STANDARD;
