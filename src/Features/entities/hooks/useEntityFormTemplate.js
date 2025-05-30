import {useEffect, useState} from "react";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";

import getListingEntityModelTemplateAsync from "Features/form/services/getListingEntityModelTemplateAsync";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useEntityFormTemplate() {
  // data

  const {value: listing} = useSelectedListing({withEntityModel: true});
  const appConfig = useAppConfig();

  // helpers
  const entityModelsObject = appConfig?.entityModelsObject;

  // state

  const [template, setTemplate] = useState({});

  // effect

  const setTemplateAsync = async () => {
    const template = await getListingEntityModelTemplateAsync({
      listing,
      entityModelsObject,
    });
    setTemplate(template);
  };

  useEffect(() => {
    if (listing?.id) {
      setTemplateAsync();
    }
  }, [listing?.id]);

  return template;
}
