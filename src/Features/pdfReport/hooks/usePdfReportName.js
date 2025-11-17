export default function usePdfReportName() {
  const date = new Date().toISOString().split("T")[0];

  return `rapport_${date}`;
}
