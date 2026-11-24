import BandSideSummary from "./BandSideSummary";

// ---------------------------------------------------------------------------
// BandBaseMapsSummary — band at the top of the base maps list ("Fonds de
// plan" side of the annotations poppers, detached PopperBaseMapsList, docked
// Dessin panel): « N fonds de plan » on the left (the base maps listed, see
// the `renderHeader` prop of SectionBaseMapsList), the actions on the right
// (`children`: the detach / attach icon of the list in the poppers). Sticky,
// so it stays in place while the list scrolls.
// ---------------------------------------------------------------------------

export default function BandBaseMapsSummary({
  baseMapsCount = 0,
  children,
  sx,
}) {
  // strings

  const n = baseMapsCount;
  const titleS = `${n} fond${n > 1 ? "s" : ""} de plan`;

  // render

  return (
    <BandSideSummary
      title={titleS}
      sx={{ position: "sticky", top: 0, zIndex: 2, ...sx }}
    >
      {children}
    </BandSideSummary>
  );
}
