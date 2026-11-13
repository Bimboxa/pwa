// A « system » is defined by a listing of annotation templates
// (`listing.system = { procedureKey, params? }`):
//   - one template of the listing is the SOURCE (`template.systemRole ===
//     "SOURCE"`): the annotation the user draws;
//   - the other templates carry the role of a generated element
//     (`template.systemRole === "PLATFORM"`, …);
//   - the procedure (appConfig.systemProcedures, type
//     SYSTEM_GENERATOR) derives the generated annotations from the source.
//
// A regular listing references a system through a template of drawing shape
// SYSTEM (`template.systemListingId`): arming it arms the system's source
// template (Features/systems/hooks/useSystemDrawTarget); its `image` is the
// illustration of the system.
//
// A system INSTANCE is one source annotation (stamped `systemApplied`) + its
// generated annotations (`systemSourceAnnotationId`, `systemElementKey`), kept
// in sync by useSystemsSync.

export const SYSTEM_DRAWING_SHAPE = "SYSTEM";
export const SYSTEM_ROLE_SOURCE = "SOURCE";
export const SYSTEM_PROCEDURE_TYPE = "SYSTEM_GENERATOR";

// Display mode of an instance, per editor (`annotation.systemDisplay`).
export const SYSTEM_DISPLAY_SOURCE = "SOURCE";
export const SYSTEM_DISPLAY_DETAIL = "DETAIL";
export const SYSTEM_DISPLAY_EDITOR_2D = "in2d";
export const SYSTEM_DISPLAY_EDITOR_3D = "in3d";
export const DEFAULT_SYSTEM_DISPLAY = {
  [SYSTEM_DISPLAY_EDITOR_2D]: SYSTEM_DISPLAY_SOURCE,
  [SYSTEM_DISPLAY_EDITOR_3D]: SYSTEM_DISPLAY_DETAIL,
};
