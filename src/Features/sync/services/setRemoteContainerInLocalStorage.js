export default function setRemoteContainerInLocalStorage(remoteContainer) {
  const remoteContainerS = remoteContainer
    ? JSON.stringify(remoteContainer)
    : null;
  console.log("[localStorage] remoteContainer", remoteContainerS);
  localStorage.setItem("remoteContainer", remoteContainerS);
}
