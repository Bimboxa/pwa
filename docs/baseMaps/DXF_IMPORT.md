# DXF base maps

DXF is disabled by default. Enable **Fichier DXF** under **Configuration >
Fonds de plan > Sources de fonds de plan** to expose the source card and accept
DXF file drops. Explicit per-scope source settings take precedence over defaults.
The creation section lazy-loads the import dialog only when DXF is enabled and
a DXF file is selected or dropped. Disabling the source closes the dialog and
clears the pending file; the dialog cleans up its parsing worker on unmount.

The DXF source card and file-drop entry open a preparation dialog. Parsing is
performed in a worker; no records are created until the user confirms.

An import atomically creates the source file, two raster versions, a base map
(`fromDXF: true`, `dxf` provenance), a dedicated annotation listing, layers and
normalized points. The active **DXF — Annotations** version is a blank backing
image so hiding a layer removes its drawing completely. Selecting **DXF — Image
de référence** displays the original visible raster and suppresses the imported
annotations. User-created annotations remain visible.

## Geometry and text

- LINE, POLYLINE and LWPOLYLINE become polylines. Closed outlines stay unfilled.
- ARC, CIRCLE, ELLIPSE and polyline bulges are sampled into polylines.
- INSERT expands nested blocks with their transforms and layer/color inheritance.
- TEXT and MTEXT become FREE_TEXT annotations. Paragraphs, Unicode escapes and
  stacked fraction content are retained. Position, rotation and attachment are
  converted to the annotation's center anchor. The original inline font/color
  runs are flattened to Arial with a uniform entity color. Width-based wrapping
  is prepared once for the preview, raster and annotation. Font sizes and box
  widths are converted to page points using the initial A3 print zone.
- DIMENSION expands its cached drawing block into lines, arrowhead polygons and
  editable text. These are graphical annotations, not associative dimensions.
  Without a cached block, linear/aligned dimensions get a simplified drawing;
  other dimension types without a block are reported as unsupported.
- SOLID entities, including filled dimension arrows, become filled polygons.
- HATCH becomes one polygon per outer island with nested holes stored as cuts.
  Polyline, line, circular-arc and elliptical-arc boundaries are supported.
  Normal, outer and ignore-islands hatch styles are respected. Pattern fills
  use the app's diagonal HATCHING style; solid fills stay solid. Original pattern
  names are retained in provenance, but custom CAD motifs and gradients are not
  reproduced. A missing/unsupported boundary rejects the entire hatch rather
  than silently filling a hole or bridging an absent edge.

Polygon outlines and cuts reference normalized `db.points` rows. FREE_TEXT uses
its canonical inline normalized `labelPoint` / `targetPoint` representation.
All conversions share the fixed DXF-to-image frame, including georeferenced
origins and the Y-axis flip.

## Limits

ASCII model space only; paper space, inclined/inverted normals, non-planar
geometry and spline hatch boundaries are reported rather than flattened.
The dialog reports skipped objects and simplified representations before import.
The worker is limited to 30 seconds, 30 MB input, 25,000 output annotations and
one million output vertices.

## Format references

- [Autodesk MTEXT group codes](https://help.autodesk.com/cloudhelp/2023/ENU/AutoCAD-DXF/files/GUID-5E5DB93B-F8D3-4433-ADF7-E92E250D2BAB.htm)
- [Autodesk dimension group codes](https://help.autodesk.com/cloudhelp/2023/ENU/AutoCAD-DXF/files/GUID-EDD54EAC-A339-4EBA-AEA6-EC8066505E2B.htm)
- [Autodesk hatch boundary data](https://help.autodesk.com/cloudhelp/2024/ENU/AutoCAD-DXF/files/GUID-DC5215D6-E73F-4DFF-8BE9-01CA9610FAEE.htm)
