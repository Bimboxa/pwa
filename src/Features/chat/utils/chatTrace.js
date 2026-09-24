export function createLlmTrace() {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  return {
    prefix: Array.from(bytes, (value) =>
      String.fromCharCode(65 + (value % 26))
    ).join(""),
    nextStep: 1,
  };
}

export function advanceLlmTrace(trace, usage) {
  if (
    !Number.isInteger(usage?.sessionStep) ||
    usage.sessionStep < 1 ||
    usage.traceCode !==
      `${trace.prefix}-${String(usage.sessionStep).padStart(2, "0")}`
  )
    return trace;
  return {
    ...trace,
    nextStep: Math.max(trace.nextStep, usage.sessionStep + 1),
  };
}
