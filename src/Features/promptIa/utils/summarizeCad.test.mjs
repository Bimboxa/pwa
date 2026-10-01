import assert from "node:assert/strict";
import { test } from "node:test";

import summarizeDxf, { getDxfEncoding } from "./summarizeDxf.js";
import summarizeIfc, {
  decodeStepString,
  splitStepArgs,
} from "./summarizeIfc.js";
import {
  getPromptIaAttachmentKind,
  getPromptIaAttachmentRejection,
} from "./promptIaAttachmentTypes.js";

const dxf = (pairs) => pairs.map(([c, v]) => `${c}\n${v}`).join("\n") + "\n";

const DXF = dxf([
  [0, "SECTION"],
  [2, "HEADER"],
  [9, "$ACADVER"],
  [1, "AC1032"],
  [9, "$INSUNITS"],
  [70, 6],
  [9, "$EXTMIN"],
  [10, "1040919.2991"],
  [20, "6295216.9446"],
  [30, "0.0"],
  [9, "$EXTMAX"],
  [10, "1040971.8706"],
  [20, "6295296.8091"],
  [30, "0.0"],
  [0, "ENDSEC"],
  [0, "SECTION"],
  [2, "BLOCKS"],
  [0, "BLOCK"],
  [8, "0"],
  [2, "Massif-5424224"],
  [0, "LINE"],
  [8, "0"],
  [0, "ENDBLK"],
  [0, "ENDSEC"],
  [0, "SECTION"],
  [2, "ENTITIES"],
  [0, "LINE"],
  [8, "A-WALL"],
  [10, 0],
  [20, 0],
  [0, "LINE"],
  [8, "A-WALL"],
  [0, "INSERT"],
  [8, "A-GENM"],
  [2, "Massif-5424224"],
  [0, "INSERT"],
  [8, "A-GENM"],
  [2, "Massif-5424224"],
  [0, "MTEXT"],
  [8, "A-GENM-IDEN"],
  [1, "Coulage différé"],
  [0, "ENDSEC"],
  [0, "EOF"],
]);

test("summarizeDxf reads the unit, the extents, the layers and the blocks", () => {
  const s = summarizeDxf(DXF);
  assert.equal(s.version, "AC1032");
  assert.deepEqual(s.unit, { code: 6, name: "m", meters: 1 });
  assert.equal(s.extents.width, 52.572);
  assert.equal(s.extents.height, 79.864);
  assert.equal(s.entityCount, 5);
  assert.deepEqual(s.entitiesByType, { LINE: 2, INSERT: 2, MTEXT: 1 });
  assert.equal(s.layerCount, 3);
  assert.deepEqual(s.layers[0], {
    name: "A-WALL",
    count: 2,
    byType: { LINE: 2 },
  });
  assert.equal(s.blockDefinitionCount, 1);
  assert.deepEqual(s.insertedBlocks, [
    { name: "Massif-5424224", layer: "A-GENM", count: 2 },
  ]);
});

test("summarizeDxf decodes the bytes with the encoding of the version", () => {
  const bytes = new TextEncoder().encode(DXF);
  assert.deepEqual(getDxfEncoding(bytes), {
    version: "AC1032",
    encoding: "utf-8",
  });
  assert.equal(summarizeDxf(bytes).entityCount, 5);
  const old = new TextEncoder().encode(DXF.replace("AC1032", "AC1015"));
  assert.equal(getDxfEncoding(old).encoding, "windows-1252");
});

test("summarizeDxf rejects what is not a DXF", () => {
  assert.equal(summarizeDxf("hello"), null);
  assert.equal(summarizeDxf("a\nb\nc\nd\ne\nf"), null);
});

const IFC = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');
FILE_NAME('m.ifc','2026-07-15T18:16:28+01:00',(''),(''),'ODA SDAI 22.12','Autodesk Revit 23.1 (FRA)','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#3=IFCCARTESIANPOINT((0.,0.,0.));
#9=IFCDIRECTION((0.,0.,1.));
#19=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);
#27=IFCPROJECT('1lGp',#18,'B-001984','Station \\X\\C9puration',$,'STEP 2','PRO',(#22),#94709);
#29=IFCAXIS2PLACEMENT3D(#3,$,$);
#30=IFCLOCALPLACEMENT(#64,#29);
#36=IFCBUILDINGSTOREY('0WeK',#18,'Niv. + 13.50, toiture','SOUS DALLE',$,#35,$,'Niv. + 13.50',.ELEMENT.,13.5001);
#40=IFCBUILDINGSTOREY('3qOD',#18,'Niv. - 0.37',$,$,#39,$,'Niv. - 0.37',.ELEMENT.,-0.3698);
#61=IFCCARTESIANPOINT((1041038.5271235064,6295141.4052699124,-0.0001));
#62=IFCDIRECTION((0.33216113188369828,0.94322265794760285,0.));
#63=IFCAXIS2PLACEMENT3D(#61,#9,#62);
#64=IFCLOCALPLACEMENT($,#63);
#65=IFCSITE('1lGq',#18,'HALIOTIS',$,$,#64,$,'36_',.ELEMENT.,(42,24,53,508911),(-71,-15,-29,-58837),0.,$,$);
#100=IFCWALL('a',#18,'Mur',$,$,#30,#99,'1',.NOTDEFINED.);
#101=IFCWALL('b',#18,'Mur',$,$,#30,#99,'2',.NOTDEFINED.);
#102=IFCSLAB('c',#18,'Sol:AEC, 35cm',$,$,#30,#99,'3',.FLOOR.);
#200=IFCRELCONTAINEDINSPATIALSTRUCTURE('r',#18,$,$,(#100,#101,#102),#36);
ENDSEC;
END-ISO-10303-21;
`;

test("summarizeIfc reads the schema, the unit, the storeys and the site", () => {
  const s = summarizeIfc(IFC);
  assert.equal(s.schema, "IFC4");
  assert.equal(s.application, "Autodesk Revit 23.1 (FRA)");
  assert.equal(s.project, "Station Épuration");
  assert.deepEqual(s.lengthUnit, { name: "METRE", meters: 1 });
  assert.deepEqual(s.elementsByClass, { IFCWALL: 2, IFCSLAB: 1 });
  assert.equal(s.elementCount, 3);
  assert.deepEqual(
    s.storeys.map((x) => [x.name, x.elevation, x.elementCount]),
    [
      ["Niv. - 0.37", -0.3698, 0],
      ["Niv. + 13.50, toiture", 13.5001, 3],
    ]
  );
  assert.equal(s.site.name, "HALIOTIS");
  assert.deepEqual(s.site.location, {
    x: 1041038.5271,
    y: 6295141.4053,
    z: -0.0001,
  });
  assert.equal(s.site.angleDeg, 70.5975);
  assert.equal(s.mapConversion, null);
});

test("summarizeIfc reads millimetres and rejects other texts", () => {
  const mm = summarizeIfc(
    IFC.replace(
      "(*,.LENGTHUNIT.,$,.METRE.)",
      "(*,.LENGTHUNIT.,.MILLI.,.METRE.)"
    )
  );
  assert.deepEqual(mm.lengthUnit, { name: "MILLIMETRE", meters: 0.001 });
  assert.equal(summarizeIfc("hello"), null);
});

test("STEP helpers", () => {
  assert.equal(decodeStepString("R\\X\\E9Ut"), "RéUt");
  assert.equal(decodeStepString("\\X2\\00E900E8\\X0\\"), "éè");
  assert.equal(decodeStepString("l''eau"), "l'eau");
  assert.deepEqual(splitStepArgs("'a, (b)',#1,(1.,2.),$,.T."), [
    "'a, (b)'",
    "#1",
    "(1.,2.)",
    "$",
    ".T.",
  ]);
});

test("attachment kinds and rejections", () => {
  assert.equal(getPromptIaAttachmentKind("plan.DXF"), "DXF");
  assert.equal(getPromptIaAttachmentKind("m.ifc"), "IFC");
  assert.equal(getPromptIaAttachmentKind("m.ifczip"), "IFC");
  assert.equal(getPromptIaAttachmentKind("c.pdf"), "PDF");
  assert.equal(getPromptIaAttachmentKind("p.jpeg"), "IMAGE");
  assert.equal(getPromptIaAttachmentKind("t.csv"), "OTHER");
  assert.equal(getPromptIaAttachmentRejection({ name: "plan.dxf" }), null);
  assert.equal(
    getPromptIaAttachmentRejection({ name: "scan", type: "application/pdf" }),
    null
  );
  assert.match(getPromptIaAttachmentRejection({ name: "a.dwg" }), /DXF/);
  assert.match(getPromptIaAttachmentRejection({ name: "a.exe" }), /format/);
});
