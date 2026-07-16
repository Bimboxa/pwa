// PHOTOREAL material presets, selected per annotation template via its
// optional `material3d` field. Single source of truth for both the material
// factory (pbrMaterials) and the template form options.
//
// - `textures`: folder name under public/photoreal/textures/ holding
//   color.jpg / normal.jpg / roughness.jpg (1K CC0 sets), or null for a
//   texture-less physical preset.
// - `textureScaleM`: real-world size (meters) covered by one texture tile —
//   UVs are in meters (applyWorldBoxUVs), so texture.repeat = 1/scale.
// - `tint`: when true the annotation's own color multiplies the albedo (the
//   whole color for untextured presets); when false the texture's albedo wins
//   (a saturated annotation color × concrete albedo reads muddy).
export const MATERIAL3D_PRESETS = {
  BETON: {
    label: "Béton",
    textures: "beton",
    textureScaleM: 1.5,
    tint: false,
    roughness: 1,
  },
  RESINE: {
    label: "Résine",
    textures: null,
    tint: true,
    roughness: 0.3,
    clearcoat: 0.6,
    clearcoatRoughness: 0.25,
  },
  GRAVIER: {
    label: "Gravier",
    textures: "gravier",
    textureScaleM: 0.8,
    tint: false,
    roughness: 1,
  },
  ISOLANT: {
    label: "Isolant",
    textures: "isolant",
    textureScaleM: 1.0,
    tint: true,
    roughness: 1,
  },
  MEMBRANE: {
    label: "Membrane",
    textures: "membrane",
    textureScaleM: 1.5,
    tint: true,
    roughness: 1,
  },
  METAL: {
    label: "Métal",
    textures: null,
    tint: true,
    roughness: 0.35,
    metalness: 0.85,
  },
};

export function getMaterial3dPreset(key) {
  if (!key) return null;
  return MATERIAL3D_PRESETS[key] ?? null;
}

// Options for the template form select (French labels, preset keys stored in
// db). "NONE" is a form-only sentinel — the form maps it back to null so
// templates without a material stay clean.
export const MATERIAL3D_NONE_KEY = "NONE";
export const MATERIAL3D_OPTIONS = [
  { key: MATERIAL3D_NONE_KEY, label: "Aucun (couleur unie)" },
  ...Object.entries(MATERIAL3D_PRESETS).map(([key, preset]) => ({
    key,
    label: preset.label,
  })),
];
