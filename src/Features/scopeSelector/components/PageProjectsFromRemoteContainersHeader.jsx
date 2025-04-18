import useRemoteToken from "Features/sync/hooks/useRemoteToken";

import ButtonLoginDropbox from "Features/dropbox/components/ButtonLoginDropbox";

export default function PageProjectsFromRemoteContainersHeader() {
  // data

  const {value: accessToken} = useRemoteToken();

  // helpers

  const isLogged = Boolean(accessToken);

  // return logged in

  if (isLogged) {
    return <div />;
  } else {
    return <ButtonLoginDropbox />;
  }
}
