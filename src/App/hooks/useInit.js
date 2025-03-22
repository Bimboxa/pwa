import useInitSelectedListing from "Features/listings/hooks/useInitSelectedListing";
import useInitFetchServicesCredentials from "Features/servicesCredentials/hooks/useInitFetchServicesCredentials";

export default function useInit() {
  useInitSelectedListing();

  useInitFetchServicesCredentials();
}
