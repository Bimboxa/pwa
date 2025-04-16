import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function useRemoteProjectsContainers() {
  const appConfig = useAppConfig();
  const projectsContainer = appConfig?.remoteProjectsContainer;

  return {value: projectsContainer, loading: false};
}
