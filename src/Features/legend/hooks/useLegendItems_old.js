import useMarkers from "Features/markers/hooks/useMarkers";

export default function useLegendItems() {
  // data

  const markers = useMarkers();

  console.log("markers", markers);

  // helpers

  const iconIndexes = [...new Set(markers?.map((m) => m.iconIndex))];

  const legendItems = iconIndexes?.map((iconIndex) => {
    return {
      iconIndex,
      iconColor: markers.find((m) => m.iconIndex === iconIndex).iconColor,
    };
  });

  return legendItems;
}
