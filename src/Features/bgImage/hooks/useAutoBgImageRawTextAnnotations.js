import { useEffect } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setBgImageRawTextAnnotations } from "../bgImageSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useDataMapping from "Features/appConfig/hooks/useDataMapping";

export default function useAutoBgImageRawTextAnnotations() {
  const dispatch = useDispatch();
  // data

  const dataMapping = useDataMapping();
  console.log("dataMapping", dataMapping);

  const oldRawTextAnnotations = useSelector(
    (s) => s.bgImage.bgImageRawTextAnnotations
  );
  const bgImageKey = useSelector((s) => s.bgImage.bgImageKeyInMapEditor);
  const appConfig = useAppConfig();
  const bgImage = appConfig?.features?.bgImages?.options?.find(
    ({ key }) => key === bgImageKey
  );

  useEffect(() => {
    const result = { ...oldRawTextAnnotations };
    //
    bgImage?.textAnnotations.forEach(({ key, mappedTo }) => {
      if (!result[key] && mappedTo) {
        result[key] = dataMapping.object[mappedTo];
      }
    });
    //
    dispatch(setBgImageRawTextAnnotations(result));
  }, [dataMapping.hash]);
}
