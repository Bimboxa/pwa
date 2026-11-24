import BandSideSummary from "./BandSideSummary";

// ---------------------------------------------------------------------------
// BandAnnotationsSummary — band right under the header of the Dessin popper
// (and of the docked Dessin panel), on the annotations side only:
// « X annotations sur N fonds de plan » on the left (counts from
// usePopperBaseMapsCounts), the actions of the side on the right
// (`children`: the "Compact" toggle and the "Propriétés" button in the
// popper, nothing in the docked panel).
// ---------------------------------------------------------------------------

export default function BandAnnotationsSummary({
  annotationsCount = 0,
  baseMapsCount = 0,
  children,
  sx,
}) {
  // strings

  const x = annotationsCount;
  const n = baseMapsCount;
  const titleS = `${x} annotation${x > 1 ? "s" : ""} sur ${n} fond${n > 1 ? "s" : ""} de plan`;

  // render

  return (
    <BandSideSummary title={titleS} sx={sx}>
      {children}
    </BandSideSummary>
  );
}
