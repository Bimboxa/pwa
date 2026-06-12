#!/usr/bin/env python3
"""Step 4 - build the importAnnotations inline JSON from OUTDIR/polys.json.

Produces the format expected by src/Features/importAnnotations
(see docs/annotations/IMPORT_FROM_DRAWING_PROMPT.md):
normalized [0..1] coordinates, origin top-left, POLYGON annotations with
closeLine, one template per element kind.

Holes (interior contours of closed wall rings) are exported with a dedicated
"evidement" template: they must be subtracted from their parent wall polygon
(annotation subtraction feature) or deleted by the user.
"""
import argparse
import json
import os


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("outdir")
    ap.add_argument("--width-meters", type=float, default=None,
                    help="real-world width of the source image, if known")
    ap.add_argument("--wall-label", default="Mur béton")
    ap.add_argument("--column-label", default="Poteau béton")
    ap.add_argument("--decimals", type=int, default=4)
    ap.add_argument("-o", "--output", default=None, help="output path (default OUTDIR/import.json)")
    args = ap.parse_args()

    data = json.load(open(os.path.join(args.outdir, "polys.json")))
    W, H = data["imageWidth"], data["imageHeight"]

    def norm(pts):
        return [{"x": round(x / W, args.decimals), "y": round(y / H, args.decimals)} for x, y in pts]

    image = {"width": W, "height": H}
    if args.width_meters:
        image["widthMeters"] = args.width_meters

    out = {
        "version": "1.0",
        "image": image,
        "annotationTemplates": [
            {"id": "tpl_mur", "label": args.wall_label, "type": "POLYGON",
             "fillColor": "#9E9E9E", "fillOpacity": 0.45,
             "strokeColor": "#424242", "strokeWidth": 2, "strokeWidthUnit": "PX"},
            {"id": "tpl_poteau", "label": args.column_label, "type": "POLYGON",
             "fillColor": "#424242", "fillOpacity": 0.85,
             "strokeColor": "#212121", "strokeWidth": 1, "strokeWidthUnit": "PX"},
            {"id": "tpl_evidement", "label": "Évidement (à soustraire)", "type": "POLYGON",
             "fillColor": "#FF5252", "fillOpacity": 0.2,
             "strokeColor": "#D32F2F", "strokeWidth": 2, "strokeWidthUnit": "PX"},
        ],
        "annotations": [],
    }

    mi = pi = ti = 0
    for p in data["polys"]:
        if p["hole"]:
            ti += 1
            aid, tpl = f"t{ti}", "tpl_evidement"
        elif p["kind"] == "column":
            pi += 1
            aid, tpl = f"p{pi}", "tpl_poteau"
        else:
            mi += 1
            aid, tpl = f"m{mi}", "tpl_mur"
        out["annotations"].append({"id": aid, "type": "POLYGON", "annotationTemplateId": tpl,
                                   "closeLine": True, "points": norm(p["pts"])})

    order = {"m": 0, "t": 1, "p": 2}
    out["annotations"].sort(key=lambda a: (order[a["id"][0]], int(a["id"][1:])))

    # drop unused templates
    used = {a["annotationTemplateId"] for a in out["annotations"]}
    out["annotationTemplates"] = [t for t in out["annotationTemplates"] if t["id"] in used]

    dest = args.output or os.path.join(args.outdir, "import.json")
    # readable layout: one annotation per line
    lines = ["{", '"version":"1.0",', '"image":' + json.dumps(out["image"]) + ",", '"annotationTemplates":[']
    tps = out["annotationTemplates"]
    lines += [" " + json.dumps(t, ensure_ascii=False) + ("," if i < len(tps) - 1 else "")
              for i, t in enumerate(tps)]
    lines += ["],", '"annotations":[']
    ans = out["annotations"]
    lines += [" " + json.dumps(a, separators=(",", ":")) + ("," if i < len(ans) - 1 else "")
              for i, a in enumerate(ans)]
    lines += ["]", "}"]
    txt = "\n".join(lines)
    json.loads(txt)  # self-check
    with open(dest, "w") as f:
        f.write(txt)
    print(f"walls: {mi} | columns: {pi} | evidements: {ti} | "
          f"points: {sum(len(a['points']) for a in ans)} | -> {dest}")
    if ti:
        print("WARNING: evidement annotation(s) present - subtract them from their parent wall "
              "polygon (annotation subtraction) or delete them after import.")


if __name__ == "__main__":
    main()
