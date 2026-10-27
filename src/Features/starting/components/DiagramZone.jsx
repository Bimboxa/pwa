// A logical block of a starting diagram: a <g> carrying its data-zone id and
// the emphasis props of makeZoneProps (opacity / glow / data-highlighted).
// Clicking a zone selects its owning item in the list (onZoneClick).
export default function DiagramZone({
  zone,
  zoneProps,
  onZoneClick,
  children,
  ...rest
}) {
  return (
    <g
      data-zone={zone}
      {...zoneProps(zone)}
      onClick={onZoneClick ? () => onZoneClick(zone) : undefined}
      cursor={onZoneClick ? "pointer" : undefined}
      {...rest}
    >
      {children}
    </g>
  );
}
