import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

export default function useUpdateBaseMapWithImageEnhanced() {
  const updateEntity = useUpdateEntity();

  return async (entityId, file) => {
    if (!file) {
      await updateEntity(entityId, {
        showEnhanced: false,
        imageEnhanced: null,
      });
      return;
    }

    await updateEntity(entityId, {
      showEnhanced: true,
      imageEnhanced: { file },
    });
  };
}
