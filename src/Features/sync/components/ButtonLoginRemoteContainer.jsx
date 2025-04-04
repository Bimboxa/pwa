import ButtonLoginDropbox from "Features/dropbox/components/ButtonLoginDropbox";

export default function ButtonLoginRemoteContainer({remoteContainer}) {
  const service = remoteContainer?.service;

  // render
  if (service === "DROPBOX") {
    return <ButtonLoginDropbox clientId={remoteContainer.clientId} />;
  }
}
