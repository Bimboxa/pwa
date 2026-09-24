// At 100 m, a relative difference of 1e-9 is 0.1 micrometers. This
// accommodates serialization/float noise without rounding the calibration
// or allowing a meaningful rescale. No absolute floor: tiny scales still
// receive the same relative protection.
export const SCALE_RELATIVE_TOLERANCE = 1e-9;

export function sameBatchScale(expected, actual) {
  if (expected === null && actual === null) return true;
  if (
    !Number.isFinite(expected) ||
    !Number.isFinite(actual) ||
    expected <= 0 ||
    actual <= 0
  )
    return false;
  return (
    Math.abs(expected - actual) <=
    SCALE_RELATIVE_TOLERANCE * Math.max(expected, actual)
  );
}

export function batchFrameDifferences(expected, actual) {
  const differences = [];
  if (!expected || !actual || expected.imageKey !== actual.imageKey)
    differences.push("imageKey");
  if (!sameBatchScale(expected?.meterByPx, actual?.meterByPx))
    differences.push("meterByPx");
  if (
    !expected?.refSize ||
    !actual?.refSize ||
    expected.refSize.width !== actual.refSize.width ||
    expected.refSize.height !== actual.refSize.height
  )
    differences.push("refSize");
  return differences;
}

export function batchFrameErrorDetail(expected, actual) {
  const differences = batchFrameDifferences(expected, actual);
  const details = differences.map((field) => {
    const before = expected?.[field];
    const after = actual?.[field];
    return `${field} (published=${JSON.stringify(before) ?? "missing"}, current=${JSON.stringify(after) ?? "missing"})`;
  });
  return details.join(", ");
}
