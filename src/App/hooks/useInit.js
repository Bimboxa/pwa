import useInitSelectListing from "Features/listings/hooks/useInitSelectListing";
import useInitFetchServicesCredentials from "Features/servicesCredentials/hooks/useInitFetchServicesCredentials";

export default function useInit() {
  useInitSelectListing();

  useInitFetchServicesCredentials();
}
