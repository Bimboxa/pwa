import getBusinessObjectQtyKind from "./getBusinessObjectQtyKind.js";

// Quantity formula of a (business object, annotation template) pair: how the
// quantity of ONE linked annotation of that template counts in the object's
// quantity. Evaluated per annotation, then summed — except a CONSTANT
// formula (no variable, e.g. "100"): it is a value entered by hand for the
// whole template, counted once whatever the number of linked annotations.
//
// Syntax: numbers (decimal "." or ","), the variables S (surface, m²),
// L (length, ml) and U (unit count) — case-insensitive —, + - * /,
// parentheses and the unary minus. E.g. "S * 1.1", "L * 2,5 + U".
//
// Only the custom formulas are stored (businessObject.qtyFormulas =
// [{annotationTemplateId, formula}], annotationTemplateId null = annotations
// without template); the default one is deduced from the object's unit
// (getDefaultQtyFormula), which is the former implicit rule.

const VARIABLES = ["S", "L", "U"];

const DEFAULT_FORMULA_BY_KIND = { SURFACE: "S", LENGTH: "L", COUNT: "U" };

// key of the formulas map for the annotations without template
export const NO_TEMPLATE_KEY = "";

function tokenize(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (/\s/.test(char)) {
      i += 1;
    } else if (/[0-9.,]/.test(char)) {
      let j = i;
      while (j < text.length && /[0-9.,]/.test(text[j])) j += 1;
      const raw = text.slice(i, j).replace(",", ".");
      if (!/^(\d+\.?\d*|\.\d+)$/.test(raw))
        throw new Error(`Nombre invalide : ${text.slice(i, j)}`);
      tokens.push({ type: "NUMBER", value: Number(raw) });
      i = j;
    } else if (/[a-zA-Z]/.test(char)) {
      let j = i;
      while (j < text.length && /[a-zA-Z]/.test(text[j])) j += 1;
      const name = text.slice(i, j).toUpperCase();
      if (!VARIABLES.includes(name))
        throw new Error(`Variable inconnue : ${text.slice(i, j)}`);
      tokens.push({ type: "VARIABLE", value: name });
      i = j;
    } else if ("+-*/()".includes(char)) {
      tokens.push({ type: char });
      i += 1;
    } else {
      throw new Error(`Caractère invalide : ${char}`);
    }
  }
  return tokens;
}

// Recursive descent parser => AST
// expression = term {("+" | "-") term}
// term       = factor {("*" | "/") factor}
// factor     = "-" factor | NUMBER | VARIABLE | "(" expression ")"
function parseTokens(tokens) {
  let index = 0;

  const peek = () => tokens[index];
  const next = () => tokens[index++];

  function parseExpression() {
    let node = parseTerm();
    while (peek()?.type === "+" || peek()?.type === "-") {
      const operator = next().type;
      node = { type: "BINARY", operator, left: node, right: parseTerm() };
    }
    return node;
  }

  function parseTerm() {
    let node = parseFactor();
    while (peek()?.type === "*" || peek()?.type === "/") {
      const operator = next().type;
      node = { type: "BINARY", operator, left: node, right: parseFactor() };
    }
    return node;
  }

  function parseFactor() {
    const token = next();
    if (!token) throw new Error("Formule incomplète");
    if (token.type === "-") return { type: "NEGATE", operand: parseFactor() };
    if (token.type === "NUMBER" || token.type === "VARIABLE") return token;
    if (token.type === "(") {
      const node = parseExpression();
      if (next()?.type !== ")") throw new Error("Parenthèse non fermée");
      return node;
    }
    throw new Error(`Symbole inattendu : ${token.type}`);
  }

  const ast = parseExpression();
  if (index < tokens.length)
    throw new Error(`Symbole inattendu : ${formatToken(tokens[index])}`);
  return ast;
}

function formatToken(token) {
  return token.value ?? token.type;
}

function evaluateNode(node, variables) {
  if (node.type === "NUMBER") return node.value;
  if (node.type === "VARIABLE") {
    const value = variables?.[node.value];
    return Number.isFinite(value) ? value : 0;
  }
  if (node.type === "NEGATE") return -evaluateNode(node.operand, variables);
  const left = evaluateNode(node.left, variables);
  const right = evaluateNode(node.right, variables);
  if (node.operator === "+") return left + right;
  if (node.operator === "-") return left - right;
  if (node.operator === "*") return left * right;
  return left / right;
}

// => {isValid, isConstant, error, evaluate({S, L, U})}. evaluate returns 0
// for a non-finite result (division by zero) and for an invalid formula.
// isConstant: the formula uses no variable.
export function parseQtyFormula(text) {
  const formula = typeof text === "string" ? text.trim() : "";
  if (!formula)
    return { isValid: false, error: "Formule vide", evaluate: () => 0 };
  try {
    const tokens = tokenize(formula);
    const ast = parseTokens(tokens);
    return {
      isValid: true,
      isConstant: !tokens.some((token) => token.type === "VARIABLE"),
      error: null,
      evaluate: (variables) => {
        const value = evaluateNode(ast, variables);
        return Number.isFinite(value) ? value : 0;
      },
    };
  } catch (e) {
    return { isValid: false, error: e.message, evaluate: () => 0 };
  }
}

// Canonical text of a formula, to compare two of them ("s*1,1" = "S * 1.1")
export function normalizeQtyFormula(text) {
  return (typeof text === "string" ? text : "")
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .toUpperCase();
}

// "S" | "L" | "U" per the unit of the object; null for a unit-less object
export function getDefaultQtyFormula(unit) {
  return DEFAULT_FORMULA_BY_KIND[getBusinessObjectQtyKind(unit)] ?? null;
}

// Variables of one annotation — same rule as accumulateAnnotationQties:
// U = 1 unless the annotation carries its own count, S / L only when the
// quantities are enabled, preferring the developed (sloped) values.
export function getAnnotationFormulaVariables(annotation) {
  const qty = annotation?.qties;
  const variables = {
    S: 0,
    L: 0,
    U: Number.isFinite(qty?.count) ? qty.count : 1,
  };
  if (qty?.enabled) {
    const length =
      qty.lengthDeveloped != null ? qty.lengthDeveloped : qty.length;
    const surface =
      qty.surfaceDeveloped != null ? qty.surfaceDeveloped : qty.surface;
    if (Number.isFinite(length)) variables.L = length;
    if (Number.isFinite(surface)) variables.S = surface;
  }
  return variables;
}

export function getQtyFormulaKey(annotationTemplateId) {
  return annotationTemplateId ?? NO_TEMPLATE_KEY;
}

// Custom formulas of a business object, parsed:
// {[annotationTemplateId | NO_TEMPLATE_KEY]: {formula, isConstant, evaluate}}.
// An invalid stored formula is skipped (the default rule applies); null
// when the object has no custom formula.
export function getQtyFormulasByTemplateId(businessObject) {
  const items = businessObject?.qtyFormulas;
  if (!Array.isArray(items) || items.length === 0) return null;
  const byTemplateId = {};
  let hasFormula = false;
  items.forEach((item) => {
    const parsed = parseQtyFormula(item?.formula);
    if (!parsed.isValid) return;
    byTemplateId[getQtyFormulaKey(item.annotationTemplateId)] = {
      formula: item.formula,
      isConstant: parsed.isConstant,
      evaluate: parsed.evaluate,
    };
    hasFormula = true;
  });
  return hasFormula ? byTemplateId : null;
}
