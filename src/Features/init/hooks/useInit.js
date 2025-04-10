import useInitDeviceType from "Features/layout/hooks/useInitDeviceType";

import useInitAppConfig from "Features/appConfig/hooks/useInitAppConfig";

import useInitSelectProject from "Features/projects/hooks/useInitSelectProject";
import useInitSelectScope from "Features/scopes/hooks/useInitSelectScope";

import useInitRemoteContainer from "Features/sync/hooks/useInitRemoteContainer";

import useInitSelectListing from "Features/listings/hooks/useInitSelectListing";

//import useInitFetchServicesCredentials from "Features/servicesCredentials/hooks/useInitFetchServicesCredentials";
//import useInitServicesConfig from "Features/settings/hooks/useInitServicesConfig";

export default function useInit() {
  useInitDeviceType();

  useInitAppConfig();

  useInitSelectProject();
  useInitSelectScope();

  useInitRemoteContainer();

  useInitSelectListing();
  //useInitFetchServicesCredentials();
  //useInitServicesConfig();
}
