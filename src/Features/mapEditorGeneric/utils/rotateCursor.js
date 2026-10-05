// Rotation cursor — circular arrow (270° arc + chevron head), white halo
// under a black stroke so it reads on any background. Hotspot = center.
// Same data-URI pattern as CURSOR_ADD / CURSOR_REMOVE in NodePolylineStatic.
// Shared by the rotation handles (DETAIL arrow ring, revolution axis cut
// axis) and by the forced drag cursor of useAnnotationDrag.
export const CURSOR_ROTATE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><g fill='none' stroke-linecap='round' stroke-linejoin='round'><path d='M12 5 A7 7 0 1 1 5 12 M2 15 L5 11 L8 15' stroke='white' stroke-width='4.5'/><path d='M12 5 A7 7 0 1 1 5 12 M2 15 L5 11 L8 15' stroke='black' stroke-width='2'/></g></svg>") 12 12, grab`;
