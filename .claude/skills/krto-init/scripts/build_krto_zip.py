"""Assemble a Krto zip from a workdir populated by the other skill scripts.

Inputs (in <workdir>):
  basemaps_index.json         — list of basemap meta dicts (pdf_to_basemaps --phase final)
  basemaps/<id>.png           — final image binaries
  basemaps/<id>.meta.json     — per-basemap metadata
  annotation_templates.json   — list of template dicts validated by the user
  validated.json              — optional, common reference points to seed

Output: a `.zip` matching the dexie-export-import format consumed by
src/Features/krtoFile/services/loadKrtoZip.js. The `images/` folder holds raw PNG
binaries; the JSON `files` table holds metadata only (no fileArrayBuffer — loadKrtoZip
re-injects ArrayBuffers at import time).
"""
from __future__ import annotations

import argparse
import io
import json
import re
import secrets
import string
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

DATABASE_NAME = "appDB"
DATABASE_VERSION = 20

# Verbatim from the reference Krto sample at /Users/FVA/Desktop/test_1_5_1_*.zip
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

CREATED_BY_USER_ID_MASTER = "krto-skill"


def nanoid(size: int = 21) -> str:
    alphabet = string.ascii_letters + string.digits + "_-"
    return "".join(secrets.choice(alphabet) for _ in range(size))


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + f"{datetime.now(timezone.utc).microsecond // 1000:03d}Z"


def sanitize_name(s: str) -> str:
    s = re.sub(r"[^\w\-]+", "_", s, flags=re.UNICODE)
    return s.strip("_")[:80] or "out"


# ---------------------------------------------------------------------------
# fractional-indexing: minimal port matching the JS `fractional-indexing` lib.
# Default alphabet 0-9A-Za-z, mid character is "a". Generates "a0","a1",...,"a9",
# "aA",...,"aZ","aa",...,"az" (up to 62 items, which suffices for this skill).
# ---------------------------------------------------------------------------
_FI_ALPHA = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"


def fi_at(i: int) -> str:
    if i < len(_FI_ALPHA):
        return f"a{_FI_ALPHA[i]}"
    # Beyond 62 items, append a second base62 digit. Rare for this skill.
    a = i // len(_FI_ALPHA)
    b = i % len(_FI_ALPHA)
    return f"a{_FI_ALPHA[a]}{_FI_ALPHA[b]}"


# ---------------------------------------------------------------------------
def make_listings(project_id, scope_id, scope_name, domain) -> list[dict]:
    """The 3 listings: shared baseMap, scoped annotation, scoped portfolioPage."""
    ts = now_iso()
    baseMap_listing_id = nanoid()
    annotation_listing_id = nanoid()
    portfolio_listing_id = nanoid()

    return [
        {
            "id": baseMap_listing_id,
            # No scopeId — shared across scopes of the project.
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
            "createdByUserIdMaster": CREATED_BY_USER_ID_MASTER,
            "updatedAt": ts,
        },
        {
            "id": annotation_listing_id,
            "scopeId": scope_id,
            "projectId": project_id,
            "name": domain or "Repérage",
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
            "createdByUserIdMaster": CREATED_BY_USER_ID_MASTER,
            "updatedAt": ts,
        },
        {
            "id": portfolio_listing_id,
            "scopeId": scope_id,
            "projectId": project_id,
            "name": scope_name,
            "sortIndex": None,
            "entityModelKey": "portfolioPage",
            "entityModel": {
                "key": "portfolioPage",
                "name": "Plan",
                "type": "PORTFOLIO_PAGE",
                "defaultTable": "portfolioPages",
            },
            "table": "portfolioPages",
            "createdBy": None,
            "createdAt": ts,
            "createdByUserIdMaster": CREATED_BY_USER_ID_MASTER,
            "updatedAt": ts,
        },
    ]


def make_basemap_rows(basemap_meta, listing_id, project_id):
    """Returns (baseMap_row, baseMapVersion_row, file_row) for one basemap."""
    ts = now_iso()
    base_id = basemap_meta["baseMapId"]
    version_id = nanoid()
    file_name = basemap_meta["fileName"]  # image_<baseMapId>.png
    w = basemap_meta["imageSize"]["width"]
    h = basemap_meta["imageSize"]["height"]
    thumb = basemap_meta["thumbnailDataUrl"]
    meter_by_px = basemap_meta["meterByPx"]

    image_obj = {
        "fileName": file_name,
        "isImage": True,
        "imageSize": {"width": w, "height": h},
        "thumbnail": thumb,
        "fileUpdatedAt": ts.replace(".", ".").split(".")[0] + "Z",
    }

    base_map = {
        "id": base_id,
        "createdBy": None,
        "listingId": listing_id,
        "name": basemap_meta["name"],
        "image": image_obj,
        "meterByPx": meter_by_px,
        "projectId": project_id,
        "createdAt": ts,
        "createdByUserIdMaster": CREATED_BY_USER_ID_MASTER,
        "updatedAt": ts,
        "refWidth": w,
        "refHeight": h,
    }

    version = {
        "id": version_id,
        "baseMapId": base_id,
        "projectId": project_id,
        "listingId": listing_id,
        "label": "Image d'origine",
        "fractionalIndex": "a0",
        "isActive": True,
        "image": image_obj,
        "transform": {"x": 0, "y": 0, "rotation": 0, "scale": 1},
        "createdAt": ts,
        "createdByUserIdMaster": CREATED_BY_USER_ID_MASTER,
        "updatedAt": ts,
    }

    file_row = {
        "fileName": file_name,
        "fileMime": "image/png",
        "srcFileName": basemap_meta["srcFileName"],
        "projectId": project_id,
        "listingId": listing_id,
        "entityId": base_id,
        "listingTable": "baseMaps",
        "createdBy": None,
        "createdAt": ts.split(".")[0] + "Z",
        "updatedAt": ts.split(".")[0] + "Z",
        "fileType": "IMAGE",
        "createdByUserIdMaster": CREATED_BY_USER_ID_MASTER,
    }

    return base_map, version, file_row


def make_annotation_template_rows(templates, listing_id, project_id):
    """Convert user-validated template defs into Dexie rows.

    Each template dict has: label, drawingShape, fillColor|strokeColor, mainQtyKey,
    mappingCategories?, overrideFields?, defaultTool?, fillType?, fillOpacity?,
    strokeWidth?, strokeWidthUnit?, strokeOpacity?, size?, sizeUnit?, height?.
    """
    ts = now_iso()
    rows = []
    for i, t in enumerate(templates):
        tid = nanoid()
        color_part = (t.get("fillColor") or t.get("strokeColor") or "").upper()
        icon_part = t.get("iconKey", "")
        code = f"{listing_id}_undefined_{color_part}_{icon_part}"
        row = {
            "id": tid,
            "createdBy": None,
            "listingId": listing_id,
            "label": t["label"],
            "labelLegend": t.get("labelLegend", t["label"]),
            "mappingCategories": t.get("mappingCategories", []),
            "drawingShape": t["drawingShape"],
            "mainQtyKey": t.get("mainQtyKey", "S"),
            "overrideFields": t.get("overrideFields", []),
            "projectId": project_id,
            "orderIndex": fi_at(i),
            "code": code,
            "createdAt": ts,
            "createdByUserIdMaster": CREATED_BY_USER_ID_MASTER,
            "updatedAt": ts,
            "$types": {
                "mappingCategories": "arrayNonindexKeys",
                "overrideFields": "arrayNonindexKeys",
            },
        }
        # Optional shape-specific fields
        for k in (
            "fillColor", "fillType", "fillOpacity",
            "strokeColor", "strokeType", "strokeOpacity", "strokeWidth", "strokeWidthUnit", "strokeOffset",
            "size", "sizeUnit", "height", "iconKey", "defaultTool", "showSlope",
        ):
            if k in t:
                row[k] = t[k]
        rows.append(row)
    return rows


def make_calibration_template(listing_id, project_id):
    """A built-in POINT template used to mark validated common reference points."""
    ts = now_iso()
    tid = nanoid()
    return {
        "id": tid,
        "createdBy": None,
        "listingId": listing_id,
        "label": "Point de calibration",
        "labelLegend": "Point de calibration",
        "mappingCategories": [],
        "drawingShape": "POINT",
        "fillColor": "#f44336",
        "size": 10,
        "sizeUnit": "PX",
        "mainQtyKey": "U",
        "overrideFields": ["fillColor"],
        "projectId": project_id,
        "orderIndex": "zz",  # sort last alphabetically
        "code": f"{listing_id}_undefined_#F44336_circle_calib",
        "iconKey": "circle",
        "createdAt": ts,
        "createdByUserIdMaster": CREATED_BY_USER_ID_MASTER,
        "updatedAt": ts,
        "$types": {
            "mappingCategories": "arrayNonindexKeys",
            "overrideFields": "arrayNonindexKeys",
        },
    }


def make_calibration_points_and_annotations(
    validated_pairs, basemaps_by_id, listing_id, project_id, calibration_template_id
):
    """For each validated pair, write 2 points + 2 annotations (one on each baseMap)."""
    points = []
    annotations = []
    ts = now_iso()
    for pair_idx, pair in enumerate(validated_pairs):
        for side in ("A", "B"):
            bid = pair[f"baseMapId{side}"]
            if bid not in basemaps_by_id:
                continue  # stale id
            x_norm = pair[f"xNorm{side}"]
            y_norm = pair[f"yNorm{side}"]
            point_id = nanoid()
            annotation_id = nanoid()
            points.append({
                "id": point_id,
                "x": x_norm,
                "y": y_norm,
                "baseMapId": bid,
                "projectId": project_id,
                "listingId": listing_id,
                "createdAt": ts,
                "createdByUserIdMaster": CREATED_BY_USER_ID_MASTER,
                "updatedAt": ts,
            })
            annotations.append({
                "id": annotation_id,
                "type": "POINT",
                "annotationTemplateId": calibration_template_id,
                "baseMapId": bid,
                "projectId": project_id,
                "listingId": listing_id,
                "createdBy": None,
                "points": [{"id": point_id}],
                "createdAt": ts,
                "createdByUserIdMaster": CREATED_BY_USER_ID_MASTER,
                "updatedAt": ts,
                "$types": {"points": "arrayNonindexKeys"},
            })
    return points, annotations


def make_layer(basemap_id, project_id, scope_id):
    ts = now_iso()
    return {
        "id": nanoid(),
        "baseMapId": basemap_id,
        "projectId": project_id,
        "scopeId": scope_id,
        "name": "Calque 1",
        "orderIndex": "a0",
        "createdAt": ts,
        "createdByUserIdMaster": CREATED_BY_USER_ID_MASTER,
        "updatedAt": ts,
    }


def make_portfolio_page_and_containers(basemaps, project_id, scope_id, portfolio_listing_id):
    ts = now_iso()
    page_id = nanoid()
    page = {
        "id": page_id,
        "createdBy": None,
        "listingId": portfolio_listing_id,
        "title": "Page 1",
        "sortIndex": "a0",
        "format": "A3",
        "orientation": "landscape",
        "type": "BASE_MAPS_PAGE",
        "projectId": project_id,
        "createdAt": ts,
        "createdByUserIdMaster": CREATED_BY_USER_ID_MASTER,
        "updatedAt": ts,
    }
    containers = []
    for i, bm in enumerate(basemaps):
        containers.append({
            "id": nanoid(),
            "portfolioPageId": page_id,
            "scopeId": scope_id,
            "projectId": project_id,
            "baseMapId": bm["baseMapId"],
            "x": 16,
            "y": 64,
            "width": 1159,
            "height": 762,
            "viewBox": None,
            "sortIndex": fi_at(i),
            "createdAt": ts,
            "createdByUserIdMaster": CREATED_BY_USER_ID_MASTER,
            "updatedAt": ts,
        })
    return page, containers


# ---------------------------------------------------------------------------
def build_project_data(workdir: Path, project_name, scope_name, domain) -> tuple[dict, list[tuple[str, bytes]]]:
    """Returns (project_data_json_dict, [(image_filename, image_bytes), ...])"""
    basemaps_index = json.loads((workdir / "basemaps_index.json").read_text())
    templates_path = workdir / "annotation_templates.json"
    validated_path = workdir / "validated.json"

    raw_templates = json.loads(templates_path.read_text()) if templates_path.exists() else []
    validated_pairs = json.loads(validated_path.read_text()) if validated_path.exists() else []

    ts = now_iso()
    project_id = nanoid()
    scope_id = nanoid()

    # Listings
    listings = make_listings(project_id, scope_id, scope_name, domain)
    baseMap_listing_id = listings[0]["id"]
    annotation_listing_id = listings[1]["id"]
    portfolio_listing_id = listings[2]["id"]

    # Project and scope rows
    project = {
        "id": project_id,
        "createdBy": None,
        "name": project_name,
        "clientRef": 0,
        "createdAt": ts,
        "createdByUserIdMaster": CREATED_BY_USER_ID_MASTER,
        "updatedAt": ts,
        "$types": {"clientRef": "undef"},
    }
    scope = {
        "id": scope_id,
        "presetScopeKey": "REPERAGE_GENERIQUE",
        "createdBy": None,
        "name": scope_name,
        "clientRef": 0,
        "projectId": project_id,
        "createdAt": ts,
        "createdByUserIdMaster": CREATED_BY_USER_ID_MASTER,
        "updatedAt": ts,
        "$types": {"clientRef": "undef"},
    }

    # BaseMaps + versions + files
    base_maps = []
    base_map_versions = []
    files = []
    images_to_zip: list[tuple[str, bytes]] = []
    basemaps_by_id = {}
    for meta in basemaps_index:
        bm, ver, file_row = make_basemap_rows(meta, baseMap_listing_id, project_id)
        base_maps.append(bm)
        base_map_versions.append(ver)
        files.append(file_row)
        basemaps_by_id[meta["baseMapId"]] = bm
        # Read PNG binary
        img_path = workdir / "basemaps" / meta["fileName"]
        images_to_zip.append((meta["fileName"], img_path.read_bytes()))

    # Layers (1 per baseMap)
    layers = [make_layer(bm["id"], project_id, scope_id) for bm in base_maps]

    # AnnotationTemplates (domain) + calibration template
    annotation_templates = make_annotation_template_rows(
        raw_templates, annotation_listing_id, project_id
    )
    calibration_template = None
    if validated_pairs:
        calibration_template = make_calibration_template(annotation_listing_id, project_id)
        annotation_templates.append(calibration_template)

    # Points + annotations for validated pairs
    points = []
    annotations = []
    if validated_pairs and calibration_template:
        points, annotations = make_calibration_points_and_annotations(
            validated_pairs, basemaps_by_id,
            annotation_listing_id, project_id, calibration_template["id"],
        )

    # Portfolio page + containers
    portfolio_page, portfolio_containers = make_portfolio_page_and_containers(
        basemaps_index, project_id, scope_id, portfolio_listing_id
    )

    # Build rows-by-table mapping (every table from TABLES_SCHEMA must appear)
    rows_by_table: dict[str, list] = {name: [] for name, _ in TABLES_SCHEMA}
    rows_by_table["projects"] = [project]
    rows_by_table["scopes"] = [scope]
    rows_by_table["listings"] = listings
    rows_by_table["baseMaps"] = base_maps
    rows_by_table["baseMapVersions"] = base_map_versions
    rows_by_table["annotationTemplates"] = annotation_templates
    rows_by_table["points"] = points
    rows_by_table["annotations"] = annotations
    rows_by_table["layers"] = layers
    rows_by_table["portfolioPages"] = [portfolio_page]
    rows_by_table["portfolioBaseMapContainers"] = portfolio_containers
    rows_by_table["files"] = files

    # Assemble final dexie export structure
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
    return project_data, images_to_zip


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--workdir", required=True)
    p.add_argument("--project-name", required=True)
    p.add_argument("--scope-name", required=True)
    p.add_argument("--domain", default="", help="Business domain label (free text)")
    p.add_argument("--out", required=True, help="Output .zip path")
    args = p.parse_args(argv)

    workdir = Path(args.workdir)
    project_data, images = build_project_data(
        workdir, args.project_name, args.scope_name, args.domain
    )

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        zf.writestr("project_data.json", json.dumps(project_data, ensure_ascii=False))
        for fname, blob in images:
            zf.writestr(f"images/{fname}", blob)

    summary = {
        "out": str(out_path),
        "outSizeBytes": out_path.stat().st_size,
        "baseMaps": len(project_data["data"]["data"][4]["rows"]),  # index of "baseMaps" — fragile but ok
    }
    # Recompute more robustly using table names
    by_name = {d["tableName"]: len(d["rows"]) for d in project_data["data"]["data"]}
    summary["counts"] = by_name
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
