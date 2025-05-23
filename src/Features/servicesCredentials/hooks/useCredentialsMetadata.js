import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import servicesMap from "../data/servicesMap";

export default function useCredentialsMetadata() {
  const appConfig = useAppConfig();

  if (!appConfig) {
    return [];
  }

  const containers = appConfig.remoteContainers;

  const metadata = [];

  containers.forEach((container) => {
    const service = servicesMap.get(container.service);

    service.credentialsMetadata.forEach((metadataItem) => {
      metadata.push({
        serviceName: service.serviceName,
        ...metadataItem,
        container,
      });
    });
  });

  return metadata;
}
