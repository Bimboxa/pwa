import { useDispatch, useSelector } from "react-redux";

import { triggerBaseMapViewsUpdate } from "../baseMapViewsSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import createBaseMapViewService from "../services/createBaseMapViewService";

export default function useCreateBaseMapView() {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const _scopeId = useSelector((s) => s.scopes.selectedScopeId);

  // helpers

  const bgImages = appConfig?.features?.baseMaps?.bgImages;
  const defaultBgImage = bgImages?.find((i) => i.isDefault);

  const props = {
    name: "Plan n°01",
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

  const create = async ({ name, scopeId, baseMap }) => {
    const baseMapView = await createBaseMapViewService({
      ...props,
      name,
      scopeId: scopeId ?? _scopeId,
      baseMap,
    });

    return baseMapView;
  };

  return create;
}
