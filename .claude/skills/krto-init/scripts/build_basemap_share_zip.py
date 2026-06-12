"""Build a "base map + annotations" zip consumable by the PWA card
« Charger un fond de plan avec annotations » (loadBaseMapShareZip.js).

Output zip layout (Dexie export-import format, databaseVersion 20):

    <out>.zip
    ├── project_data.json   # formatName: "dexie", formatVersion: 1
    └── images/
        └── image_<baseMapId>.png   # white canvas background

The importer remaps every internal id and reassigns projectId/scopeId to the
current scope, so the ids written here only need to be internally consistent.

This particular build vectorizes page 2 of "Carnet de détails.pdf": an
L-shaped waterproofing detail (1.5 m vertical relevé, 1.0 m horizontal slab)
on a WHITE canvas. Every stroke becomes a POLYLINE annotation; the two
dimensions become COTE annotations. Element names are carried by
annotationTemplates.
"""
from __future__ import annotations

import argparse
import base64
import json
import math
import secrets
import string
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

DATABASE_NAME = "appDB"
DATABASE_VERSION = 20
CREATED_BY = "basemap-share-skill"

# Verbatim table schema (matches build_krto_zip.py / the reference Krto sample).
TABLES_SCHEMA = [
    ("orgaData", "key"),
    ("projects", "id,clientRef,__importTag"),
    ("projectFiles", "id"),
    ("scopes", "id,projectId"),
    ("baseMaps", "id,listingId,projectId"),
    ("baseMapViews", "id,scopeId,baseMapId"),
    ("baseMapTransforms", "id"),
    ("blueprints", "id,projectId,scopeId,listingId"),
    ("listings", "id,key,uniqueByProject,projectId,scopeId"),
    ("entities", "id,projectId,listingId,[listingId+createdBy]"),
    ("maps", "id,projectId,listingId,[listingId+createdBy]"),
    ("zonings", "listingId"),
    ("materials", "id,projectId,listingId,[listingId+createdBy]"),
    ("relsZoneEntity", "id,projectId,listingId,zoneId,entityId"),
    ("entitiesProps", "id,[listingKey+targetEntityId],listingKey,targetListingKey,targetEntityId"),
    ("legends", "id,listingId"),
    ("markers", "id,mapId,listingId,targetEntityId"),
    ("points", "id,projectId,listingId,baseMapId"),
    ("annotations", "id,projectId,baseMapId,listingId,entityId,annotationTemplateId"),
    ("annotationTemplates", "id,projectId,listingId,code,label"),
    ("files", "fileName,projectId,listingId,entityId"),
    ("relationsEntities", "id,listingId,sourceEntityId,targetEntityId,relationType"),
    ("reports", "id,listingId"),
    ("syncFiles", "path,scopeId"),
    ("portfolioPages", "id,listingId,scopeId,projectId"),
    ("portfolioBaseMapContainers", "id,portfolioPageId,scopeId,projectId"),
    ("entityModels", "id,projectId,key"),
    ("relAnnotationMappingCategory", "id,annotationId,projectId,[nomenclatureKey+categoryKey]"),
    ("baseMapVersions", "id,baseMapId,projectId,listingId"),
    ("layers", "id,baseMapId,projectId,scopeId"),
]

# Canvas + scale ----------------------------------------------------------------
IMG_W = 1000
IMG_H = 1400
METER_BY_PX = 0.0025  # 600 px -> 1.5 m ; 400 px -> 1.0 m

_FI_ALPHA = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"


def nanoid(size: int = 21) -> str:
    alphabet = string.ascii_letters + string.digits + "_-"
    return "".join(secrets.choice(alphabet) for _ in range(size))


def now_iso() -> str:
    n = datetime.now(timezone.utc)
    return n.strftime("%Y-%m-%dT%H:%M:%S.") + f"{n.microsecond // 1000:03d}Z"


def fi_at(i: int) -> str:
    if i < len(_FI_ALPHA):
        return f"a{_FI_ALPHA[i]}"
    return f"a{_FI_ALPHA[i // len(_FI_ALPHA)]}{_FI_ALPHA[i % len(_FI_ALPHA)]}"


# ------------------------------------------------------------------------------
# Drawing definition: page 2 of "Carnet de détails.pdf"
#
# An L-shaped waterproofing detail: vertical relevé (1.5 m) against the existing
# wall, horizontal run (1.0 m) on the new slab. Successive coating layers wrap
# the re-entrant corner over a *gorge* — a cove fillet (ragréage), drawn as a
# filled POLYGON — that rounds the internal angle so the membranes keep a fine
# contour. Each layer is a parallel offset curve with a tangent arc at the
# corner, so the coats read as distinct successive layers (not squashed).
#
# Coordinates are pixels in the 1000x1400 canvas.
# ------------------------------------------------------------------------------
WALL_X = 360          # wall room-face (vertical substrate line)
WALL_BACK_X = 312     # wall back-face
SLAB_Y = 1060         # slab top (horizontal substrate line)
RELEVE_TOP = 470      # top of the relevé (membranes)
SLAB_RIGHT = 752      # far end of the run on the slab
BEND_R = 56           # bend radius of the gorge cove / membrane layers


def arc_points(cx, cy, r, a0_deg, a1_deg, n=10):
    """Sample an arc (degrees; screen coords, +y downward)."""
    pts = []
    for k in range(n):
        t = k / (n - 1)
        a = math.radians(a0_deg + (a1_deg - a0_deg) * t)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def membrane_path(offset, y_top, x_right, r=BEND_R):
    """A coating layer: down the wall, tangent arc over the gorge, along the slab.

    `offset` shifts the layer parallel into the room so successive coats stay
    visibly spaced. The arc is tangent to both straight runs (rounded corner).
    """
    xv = WALL_X + offset           # vertical run
    yh = SLAB_Y - offset           # horizontal run
    cx, cy = xv + r, yh - r        # fillet centre, tangent to both runs
    # arc start (a=180) = (xv, yh - r); arc end (a=90) = (xv + r, yh)
    return [(xv, y_top)] + arc_points(cx, cy, r, 180, 90, 10) + [(x_right, yh)]


def gorge_polygon(r=BEND_R):
    """Cove fillet filling the internal corner (concave hypotenuse)."""
    cx, cy = WALL_X + r, SLAB_Y - r
    pts = [(WALL_X, SLAB_Y), (WALL_X, SLAB_Y - r)]
    pts += arc_points(cx, cy, r, 180, 90, 10)[1:]  # skip dup of (WALL_X, SLAB_Y-r)
    pts += [(WALL_X + r, SLAB_Y)]
    return pts


# Drawn elements (annotations), in draw order (substrate first, coats outward).
ELEMENTS = [
    {"key": "support", "points": [(WALL_BACK_X, 330), (WALL_BACK_X, 1090)]},
    {"key": "support", "points": [(WALL_X, 330), (WALL_X, 1090)]},
    {"key": "dalle", "points": [
        (WALL_X, SLAB_Y), (SLAB_RIGHT + 48, SLAB_Y),
        (SLAB_RIGHT + 48, SLAB_Y + 60), (WALL_X, SLAB_Y + 60),
    ]},
    {"key": "gorge", "points": gorge_polygon()},
    {"key": "techoflex", "points": membrane_path(offset=12, y_top=946, x_right=476)},
    {"key": "techproof", "points": membrane_path(offset=26, y_top=RELEVE_TOP, x_right=730)},
    {"key": "membrane", "points": membrane_path(offset=46, y_top=RELEVE_TOP, x_right=SLAB_RIGHT)},
    {"key": "reprise", "points": [(WALL_X + 54, 462), (WALL_X + 54, 548)]},
]

# Annotation templates (styling + drawingShape), keyed for ELEMENTS / COTES.
TEMPLATES = [
    {"key": "support", "label": "Support BA existant", "drawingShape": "POLYLINE",
     "strokeColor": "#6b6b6b", "strokeWidth": 3, "mainQtyKey": "L"},
    {"key": "dalle", "label": "Dalle BA neuve", "drawingShape": "POLYLINE",
     "strokeColor": "#6b6b6b", "strokeWidth": 3, "mainQtyKey": "L"},
    {"key": "gorge", "label": "Gorge Repatech R4 (ragréage)", "drawingShape": "POLYGON",
     "fillColor": "#5cb85c", "fillOpacity": 0.45, "fillType": "SOLID",
     "strokeColor": "#3d9140", "strokeWidth": 2, "mainQtyKey": "S"},
    {"key": "techoflex", "label": "Traitement par bande Techoflex", "drawingShape": "POLYLINE",
     "strokeColor": "#e8569e", "strokeWidth": 11, "mainQtyKey": "L"},
    {"key": "techproof", "label": "Techproof PB TV45", "drawingShape": "POLYLINE",
     "strokeColor": "#3f6fd1", "strokeWidth": 6, "mainQtyKey": "L"},
    {"key": "membrane", "label": "Membrane Techoproof (relevé)", "drawingShape": "POLYLINE",
     "strokeColor": "#f4a72b", "strokeWidth": 8, "mainQtyKey": "L"},
    {"key": "reprise", "label": "Reprise enduit (VM 216 / 2 cm)", "drawingShape": "POLYLINE",
     "strokeColor": "#b8946a", "strokeWidth": 5, "mainQtyKey": "L"},
    {"key": "cote", "label": "Cote", "drawingShape": "COTE",
     "strokeColor": "#000000", "strokeWidth": 1, "mainQtyKey": "U"},
]

COTES = [
    {"points": [(290, 460), (290, 1060)]},     # vertical   -> 1.50 m
    {"points": [(360, 1130), (760, 1130)]},    # horizontal -> 1.00 m
]


# ------------------------------------------------------------------------------
def make_white_png() -> bytes:
    img = np.full((IMG_H, IMG_W, 3), 255, dtype=np.uint8)
    ok, buf = cv2.imencode(".png", img)
    if not ok:
        raise RuntimeError("PNG encode failed")
    return buf.tobytes()


def make_thumbnail_data_url() -> str:
    thumb = np.full((32, 32, 3), 255, dtype=np.uint8)
    ok, buf = cv2.imencode(".png", thumb)
    if not ok:
        raise RuntimeError("thumbnail encode failed")
    b64 = base64.b64encode(buf.tobytes()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def norm(pt):
    x, y = pt
    return x / IMG_W, y / IMG_H


def build_project_data(project_id, scope_id):
    ts = now_iso()
    base_id = nanoid()
    file_name = f"image_{base_id}.png"
    thumb = make_thumbnail_data_url()

    baseMap_listing_id = nanoid()
    annotation_listing_id = nanoid()

    image_obj = {
        "fileName": file_name,
        "isImage": True,
        "imageSize": {"width": IMG_W, "height": IMG_H},
        "thumbnail": thumb,
        "fileUpdatedAt": ts.split(".")[0] + "Z",
    }

    listings = [
        {
            "id": baseMap_listing_id,
            "projectId": project_id,
            "name": "Fonds de plan",
            "color": "#7B1FA2",
            "iconKey": "map",
            "entityModelKey": "baseMap",
            "entityModel": {
                "key": "baseMap",
                "name": "Fonds de plan",
                "type": "BASE_MAP",
                "defaultTable": "baseMaps",
            },
            "table": "baseMaps",
            "canCreateItem": True,
            "sortIndex": None,
            "createdBy": None,
            "createdAt": ts,
            "createdByUserIdMaster": CREATED_BY,
            "updatedAt": ts,
        },
        {
            "id": annotation_listing_id,
            "scopeId": scope_id,
            "projectId": project_id,
            "name": "Étanchéité — détail relevé",
            "sortIndex": None,
            "entityModelKey": "annotation",
            "entityModel": {
                "key": "annotation",
                "name": "Objet générique",
                "type": "LOCATED_ENTITY",
                "isDefault": True,
                "defaultTable": "entities",
                "defaultIconKey": "annotation",
                "defaultColor": "#FF9800",
            },
            "table": "entities",
            "canCreateItem": True,
            "createdBy": None,
            "createdAt": ts,
            "createdByUserIdMaster": CREATED_BY,
            "updatedAt": ts,
        },
    ]

    base_map = {
        "id": base_id,
        "createdBy": None,
        "listingId": baseMap_listing_id,
        "name": "Détail relevé d'étanchéité (page 2)",
        "image": image_obj,
        "meterByPx": METER_BY_PX,
        "projectId": project_id,
        "createdAt": ts,
        "createdByUserIdMaster": CREATED_BY,
        "updatedAt": ts,
        "refWidth": IMG_W,
        "refHeight": IMG_H,
    }

    base_map_version = {
        "id": nanoid(),
        "baseMapId": base_id,
        "projectId": project_id,
        "listingId": baseMap_listing_id,
        "label": "Image d'origine",
        "fractionalIndex": "a0",
        "isActive": True,
        "image": image_obj,
        "transform": {"x": 0, "y": 0, "rotation": 0, "scale": 1},
        "createdAt": ts,
        "createdByUserIdMaster": CREATED_BY,
        "updatedAt": ts,
    }

    layer = {
        "id": nanoid(),
        "baseMapId": base_id,
        "projectId": project_id,
        "scopeId": scope_id,
        "name": "Calque 1",
        "orderIndex": "a0",
        "createdAt": ts,
        "createdByUserIdMaster": CREATED_BY,
        "updatedAt": ts,
    }

    file_row = {
        "fileName": file_name,
        "fileMime": "image/png",
        "srcFileName": "Carnet de détails.pdf (p.2)",
        "projectId": project_id,
        "listingId": baseMap_listing_id,
        "entityId": base_id,
        "listingTable": "baseMaps",
        "createdBy": None,
        "createdAt": ts.split(".")[0] + "Z",
        "updatedAt": ts.split(".")[0] + "Z",
        "fileType": "IMAGE",
        "createdByUserIdMaster": CREATED_BY,
    }

    # Templates + annotations + points -----------------------------------------
    templates = []
    points = []
    annotations = []
    template_id_by_key = {}

    for i, tpl in enumerate(TEMPLATES):
        tid = nanoid()
        template_id_by_key[tpl["key"]] = tid
        shape = tpl["drawingShape"]
        color_part = (tpl.get("strokeColor") or tpl.get("fillColor") or "").upper()
        row = {
            "id": tid,
            "createdBy": None,
            "listingId": annotation_listing_id,
            "label": tpl["label"],
            "labelLegend": tpl["label"],
            "mappingCategories": [],
            "drawingShape": shape,
            "mainQtyKey": tpl.get("mainQtyKey", "L"),
            "overrideFields": ["strokeColor", "fillColor"],
            "strokeColor": tpl.get("strokeColor", "#000000"),
            "strokeWidth": tpl.get("strokeWidth", 2),
            "strokeWidthUnit": "PX",
            "strokeOpacity": 1,
            "strokeType": "SOLID",
            "projectId": project_id,
            "orderIndex": fi_at(i),
            "code": f"{annotation_listing_id}_undefined_{color_part}_",
            "createdAt": ts,
            "createdByUserIdMaster": CREATED_BY,
            "updatedAt": ts,
            "$types": {
                "mappingCategories": "arrayNonindexKeys",
                "overrideFields": "arrayNonindexKeys",
            },
        }
        if shape == "POLYGON":
            row.update({
                "fillColor": tpl.get("fillColor", "#888888"),
                "fillOpacity": tpl.get("fillOpacity", 0.5),
                "fillType": tpl.get("fillType", "SOLID"),
            })
        if shape == "COTE":
            row.update({
                "unit": "M",
                "decimals": 2,
                "fontSize": 18,
                "showUnitLabel": True,
                "extensionOffset": 8,
                "extensionOffsetUnit": "PX",
            })
        templates.append(row)

    def add_point(pt):
        nx, ny = norm(pt)
        pid = nanoid()
        points.append({
            "id": pid,
            "x": nx,
            "y": ny,
            "baseMapId": base_id,
            "projectId": project_id,
            "listingId": annotation_listing_id,
            "createdAt": ts,
            "createdByUserIdMaster": CREATED_BY,
            "updatedAt": ts,
        })
        return pid

    # POLYLINE / POLYGON annotations from ELEMENTS
    tpl_by_key = {t["key"]: t for t in TEMPLATES}
    for el in ELEMENTS:
        tpl = tpl_by_key[el["key"]]
        shape = tpl["drawingShape"]
        point_refs = [{"id": add_point(pt)} for pt in el["points"]]
        ann = {
            "id": nanoid(),
            "type": shape,
            "annotationTemplateId": template_id_by_key[el["key"]],
            "baseMapId": base_id,
            "projectId": project_id,
            "listingId": annotation_listing_id,
            "layerId": layer["id"],
            "isBaseMapAnnotation": False,
            "createdBy": None,
            "points": point_refs,
            "strokeColor": tpl.get("strokeColor", "#000000"),
            "strokeWidth": tpl.get("strokeWidth", 2),
            "strokeWidthUnit": "PX",
            "strokeOpacity": 1,
            "strokeType": "SOLID",
            "createdAt": ts,
            "createdByUserIdMaster": CREATED_BY,
            "updatedAt": ts,
            "$types": {"points": "arrayNonindexKeys"},
        }
        if shape == "POLYGON":
            ann.update({
                "fillColor": tpl.get("fillColor", "#888888"),
                "fillOpacity": tpl.get("fillOpacity", 0.5),
                "fillType": tpl.get("fillType", "SOLID"),
                "closeLine": True,
            })
        annotations.append(ann)

    # COTE annotations
    cote_tid = template_id_by_key["cote"]
    for cote in COTES:
        point_refs = [{"id": add_point(pt)} for pt in cote["points"]]
        annotations.append({
            "id": nanoid(),
            "type": "COTE",
            "annotationTemplateId": cote_tid,
            "baseMapId": base_id,
            "projectId": project_id,
            "listingId": annotation_listing_id,
            "layerId": layer["id"],
            "isBaseMapAnnotation": False,
            "createdBy": None,
            "points": point_refs,
            "strokeColor": "#000000",
            "strokeWidth": 1,
            "strokeWidthUnit": "PX",
            "strokeOpacity": 1,
            "strokeType": "SOLID",
            "unit": "M",
            "decimals": 2,
            "fontSize": 18,
            "showUnitLabel": True,
            "extensionOffset": 8,
            "extensionOffsetUnit": "PX",
            "createdAt": ts,
            "createdByUserIdMaster": CREATED_BY,
            "updatedAt": ts,
            "$types": {"points": "arrayNonindexKeys"},
        })

    rows_by_table = {name: [] for name, _ in TABLES_SCHEMA}
    rows_by_table["listings"] = listings
    rows_by_table["baseMaps"] = [base_map]
    rows_by_table["baseMapVersions"] = [base_map_version]
    rows_by_table["layers"] = [layer]
    rows_by_table["annotationTemplates"] = templates
    rows_by_table["points"] = points
    rows_by_table["annotations"] = annotations
    rows_by_table["files"] = [file_row]

    project_data = {
        "formatName": "dexie",
        "formatVersion": 1,
        "data": {
            "databaseName": DATABASE_NAME,
            "databaseVersion": DATABASE_VERSION,
            "tables": [
                {"name": name, "schema": schema, "rowCount": len(rows_by_table[name])}
                for name, schema in TABLES_SCHEMA
            ],
            "data": [
                {"tableName": name, "inbound": True, "rows": rows_by_table[name]}
                for name, _ in TABLES_SCHEMA
            ],
        },
    }
    return project_data, file_name


def validate(project_data):
    by_name = {d["tableName"]: d["rows"] for d in project_data["data"]["data"]}
    point_ids = {p["id"] for p in by_name["points"]}
    for p in by_name["points"]:
        assert 0.0 <= p["x"] <= 1.0 and 0.0 <= p["y"] <= 1.0, f"point out of [0,1]: {p}"
    for a in by_name["annotations"]:
        for ref in a["points"]:
            assert ref["id"] in point_ids, f"dangling point ref {ref['id']}"
    # cote scale check
    pt_by_id = {p["id"]: p for p in by_name["points"]}
    cotes = [a for a in by_name["annotations"] if a["type"] == "COTE"]
    meters = []
    for c in cotes:
        p1 = pt_by_id[c["points"][0]["id"]]
        p2 = pt_by_id[c["points"][1]["id"]]
        dx = (p2["x"] - p1["x"]) * IMG_W
        dy = (p2["y"] - p1["y"]) * IMG_H
        meters.append(round(math.hypot(dx, dy) * METER_BY_PX, 4))
    return {
        "cote_meters": sorted(meters),
        "counts": {k: len(v) for k, v in by_name.items() if v},
    }


def main(argv):
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    args = p.parse_args(argv)

    project_id = nanoid()
    scope_id = nanoid()
    project_data, file_name = build_project_data(project_id, scope_id)
    report = validate(project_data)

    png = make_white_png()
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        zf.writestr("project_data.json", json.dumps(project_data, ensure_ascii=False))
        zf.writestr(f"images/{file_name}", png)

    report["out"] = str(out_path)
    report["outSizeBytes"] = out_path.stat().st_size
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
