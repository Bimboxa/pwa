import { useDispatch } from "react-redux";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import createBaseMapViewService from "../services/createBaseMapViewService";

export default function useCreateBaseMapView() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();

  // helpers

  const bgImages = appConfig?.features?.baseMaps?.bgImages;
  const defaultBgImage = bgImages?.find((i) => i.isDefault);

  const props = {
    name: "Nouveau plan",
    bgImage: {
      imageUrlRemote: defaultBgImage.url,
      imageSize: {
        width: defaultBgImage?.width,
        height: defaultBgImage?.height,
      },
    },
    documentSize: {
      width: defaultBgImage?.width,
      height: defaultBgImage?.height,
    },
  };

  const create = async ({ name, scopeId }) => {
    const baseMapView = await createBaseMapViewService({
      name,
      scopeId,
      ...props,
    });

    return baseMapView;
  };

  return create;
}
