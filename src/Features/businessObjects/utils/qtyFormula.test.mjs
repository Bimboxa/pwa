import test from "node:test";
import assert from "node:assert/strict";

import {
  getAnnotationFormulaVariables,
  getDefaultQtyFormula,
  getQtyFormulasByTemplateId,
  normalizeQtyFormula,
  parseQtyFormula,
} from "./qtyFormula.js";
import setQtyFormulaForTemplate from "./setQtyFormulaForTemplate.js";
import accumulateAnnotationQties, {
  createEmptyQties,
} from "./accumulateAnnotationQties.js";
import getBusinessObjectQtyValue from "./getBusinessObjectQtyValue.js";
import getBusinessObjectQtiesByTemplate from "./getBusinessObjectQtiesByTemplate.js";

const VARIABLES = { S: 10, L: 4, U: 1 };

function evaluate(formula) {
  const parsed = parseQtyFormula(formula);
  assert.equal(parsed.isValid, true, `${formula}: ${parsed.error}`);
  return parsed.evaluate(VARIABLES);
}

test("variables and numbers", () => {
  assert.equal(evaluate("S"), 10);
  assert.equal(evaluate("l"), 4);
  assert.equal(evaluate(" u "), 1);
  assert.equal(evaluate("2.5"), 2.5);
  assert.equal(evaluate("2,5"), 2.5);
  assert.equal(evaluate(".5"), 0.5);
});

test("operators, precedence, parentheses, unary minus", () => {
  assert.equal(evaluate("S + L * 2"), 18);
  assert.equal(evaluate("(S + L) * 2"), 28);
  assert.equal(evaluate("S - L - U"), 5);
  assert.equal(evaluate("S / L / 2"), 1.25);
  assert.equal(evaluate("-S + 2"), -8);
  assert.equal(evaluate("S * -2"), -20);
  assert.equal(evaluate("L * 2,5 + U"), 11);
});

test("invalid formulas", () => {
  [
    "",
    "  ",
    "S +",
    "* S",
    "(S + L",
    "S + L)",
    "S L",
    "2 3",
    "X * 2",
    "SL",
    "1.2.3",
    "S ^ 2",
    null,
    undefined,
  ].forEach((formula) => {
    const parsed = parseQtyFormula(formula);
    assert.equal(parsed.isValid, false, String(formula));
    assert.equal(parsed.evaluate(VARIABLES), 0);
  });
});

test("constant formula counts once per template", () => {
  assert.equal(parseQtyFormula("100").isConstant, true);
  assert.equal(parseQtyFormula("2 * (3 + 1)").isConstant, true);
  assert.equal(parseQtyFormula("S * 2").isConstant, false);

  const annotations = ["a1", "a2", "a3"].map((id) => ({
    id,
    annotationTemplateId: "t1",
    qties: { enabled: true, length: 5, surface: 0 },
  }));
  annotations.push({
    id: "a4",
    annotationTemplateId: "t2",
    qties: { enabled: true, length: 7, surface: 0 },
  });
  const businessObject = {
    qtyFormulas: [{ annotationTemplateId: "t1", formula: "100" }],
  };
  const formulas = getQtyFormulasByTemplateId(businessObject);
  const stats = createEmptyQties();
  annotations.forEach((a) => accumulateAnnotationQties(stats, a, formulas));
  assert.equal(getBusinessObjectQtyValue("ml", stats), 107);

  const rows = getBusinessObjectQtiesByTemplate(annotations, businessObject);
  assert.equal(getBusinessObjectQtyValue("ml", rows[0].qties), 100);
  assert.equal(getBusinessObjectQtyValue("ml", rows[1].qties), 7);
});

test("non-finite result counts for 0", () => {
  assert.equal(parseQtyFormula("S / 0").evaluate(VARIABLES), 0);
  assert.equal(parseQtyFormula("S / (L - 4)").evaluate(VARIABLES), 0);
});

test("default formula per unit", () => {
  assert.equal(getDefaultQtyFormula("m²"), "S");
  assert.equal(getDefaultQtyFormula("M2"), "S");
  assert.equal(getDefaultQtyFormula("ml"), "L");
  assert.equal(getDefaultQtyFormula("ens"), "U");
  assert.equal(getDefaultQtyFormula("S"), "S");
  assert.equal(getDefaultQtyFormula(null), null);
  assert.equal(getDefaultQtyFormula(""), null);
});

test("annotation variables", () => {
  assert.deepEqual(
    getAnnotationFormulaVariables({
      qties: { enabled: true, length: 3, surface: 8, surfaceDeveloped: 9 },
    }),
    { S: 9, L: 3, U: 1 }
  );
  assert.deepEqual(
    getAnnotationFormulaVariables({
      qties: { enabled: false, length: 3, surface: 8 },
    }),
    { S: 0, L: 0, U: 1 }
  );
  assert.deepEqual(
    getAnnotationFormulaVariables({
      qties: { enabled: true, length: 3, surface: 0, count: 6 },
    }),
    { S: 0, L: 3, U: 6 }
  );
  assert.deepEqual(getAnnotationFormulaVariables({}), { S: 0, L: 0, U: 1 });
});

test("set formula for a template", () => {
  let formulas = setQtyFormulaForTemplate(undefined, "t1", " S * 1.1 ", "S");
  assert.deepEqual(formulas, [
    { annotationTemplateId: "t1", formula: "S * 1.1" },
  ]);
  formulas = setQtyFormulaForTemplate(formulas, null, "U * 2", "S");
  assert.equal(formulas.length, 2);
  formulas = setQtyFormulaForTemplate(formulas, "t1", "L", "S");
  assert.deepEqual(formulas, [
    { annotationTemplateId: null, formula: "U * 2" },
    { annotationTemplateId: "t1", formula: "L" },
  ]);
  // back to the default formula / emptied: entry dropped
  formulas = setQtyFormulaForTemplate(formulas, "t1", " s ", "S");
  assert.deepEqual(formulas, [
    { annotationTemplateId: null, formula: "U * 2" },
  ]);
  assert.deepEqual(setQtyFormulaForTemplate(formulas, null, "", "S"), []);
  assert.equal(normalizeQtyFormula("s * 1,1"), "S*1.1");
});

test("invalid stored formulas are skipped", () => {
  assert.equal(getQtyFormulasByTemplateId({}), null);
  assert.equal(
    getQtyFormulasByTemplateId({
      qtyFormulas: [{ annotationTemplateId: "t1", formula: "S +" }],
    }),
    null
  );
  const formulas = getQtyFormulasByTemplateId({
    qtyFormulas: [
      { annotationTemplateId: "t1", formula: "S +" },
      { annotationTemplateId: "t2", formula: "S * 2" },
    ],
  });
  assert.deepEqual(Object.keys(formulas), ["t2"]);
});

test("rollup with formulas", () => {
  const annotations = [
    {
      id: "a1",
      annotationTemplateId: "t1",
      qties: { enabled: true, length: 4, surface: 10 },
    },
    {
      id: "a2",
      annotationTemplateId: "t1",
      qties: { enabled: true, length: 6, surface: 20 },
    },
    {
      id: "a3",
      annotationTemplateId: "t2",
      qties: { enabled: true, length: 5, surface: 0 },
    },
    { id: "a4", qties: { enabled: true, length: 2, surface: 3 } },
    {
      id: "a5",
      annotationTemplateId: "t1",
      isMeshCell: true,
      qties: { enabled: true, length: 1, surface: 1 },
    },
  ];
  const businessObject = {
    unit: "m²",
    qtyFormulas: [
      { annotationTemplateId: "t1", formula: "S + 2" },
      { annotationTemplateId: "t2", formula: "L * 2,5" },
    ],
  };

  // without formula: the unit rule
  const raw = createEmptyQties();
  annotations
    .filter((a) => !a.isMeshCell)
    .forEach((a) => accumulateAnnotationQties(raw, a));
  assert.equal(raw.formula, undefined);
  assert.equal(getBusinessObjectQtyValue("m²", raw), 33);
  assert.equal(getBusinessObjectQtyValue("ml", raw), 17);
  assert.equal(getBusinessObjectQtyValue("u", raw), 4);
  assert.equal(getBusinessObjectQtyValue(null, raw), null);

  // with formulas: t1 = (10 + 2) + (20 + 2), t2 = 5 * 2.5, no template = S
  const formulas = getQtyFormulasByTemplateId(businessObject);
  const stats = createEmptyQties();
  annotations
    .filter((a) => !a.isMeshCell)
    .forEach((a) => accumulateAnnotationQties(stats, a, formulas));
  assert.equal(stats.surface, 33);
  assert.equal(getBusinessObjectQtyValue("m²", stats), 34 + 12.5 + 3);

  const rows = getBusinessObjectQtiesByTemplate(annotations, businessObject);
  assert.deepEqual(
    rows.map((r) => [
      r.annotationTemplateId,
      r.annotationsCount,
      r.annotations.length,
      r.formula,
      getBusinessObjectQtyValue("m²", r.qties),
    ]),
    [
      ["t1", 2, 3, "S + 2", 34],
      ["t2", 1, 1, "L * 2,5", 12.5],
      [null, 1, 1, null, 3],
    ]
  );
});
