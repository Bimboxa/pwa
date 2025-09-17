import useLegendItems from "./useLegendItems";

export default function useLegend() {
  // data

  const legendItems = useLegendItems();

  const legend = {
    items: legendItems,
  };

  return legend;
}
