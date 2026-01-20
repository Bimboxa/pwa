import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";
import useMainBaseMapListing from "Features/baseMaps/hooks/useMainBaseMapListing";

export default function useUpdateBaseMapWithImageEnhanced() {

  const updateEntity = useUpdateEntity();
  const mainBaseMapListing = useMainBaseMapListing();

  return async (entityId, file) => {

    if (!Boolean(file)) {
      await updateEntity(entityId, {
        showEnhanced: false,
        imageEnhanced: null,
      }, {
        listing: mainBaseMapListing,
      });
      return;
    }

    console.log("updateBaseMapWithImageEnhanced", entityId, file, mainBaseMapListing);

    await updateEntity(entityId, {
      showEnhanced: true,
      opacityEnhanced: 0.2,
      imageEnhanced: { file },
    },
      {
        listing: mainBaseMapListing,
      });
  };
}
