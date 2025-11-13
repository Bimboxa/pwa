// padding = 3 => 2 = 002, 3 = 003, 10 = 010, ...

export default function getZeroPaddingNumber(number, padding) {
  const normalizedNumber = Math.max(0, Number(number) || 0);
  return normalizedNumber.toString().padStart(padding, "0");
}
