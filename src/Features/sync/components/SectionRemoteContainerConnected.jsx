import {useEffect} from "react";

import {useDispatch} from "react-redux";

import {setRemoteContainer} from "../syncSlice";

import setRemoteContainerInLocalStorage from "../services/setRemoteContainerInLocalStorage";

import useRemoteToken from "Features/sync/hooks/useRemoteToken";

import {Box, IconButton} from "@mui/material";

import HeaderVariantTitle from "Features/layout/components/HeaderVariantTitle";
import ButtonLoginRemoteContainer from "./ButtonLoginRemoteContainer";
import SectionRemoteContainerConnexion from "./SectionRemoteContainerConnexion";
import BlockLoading from "Features/layout/components/BlockLoading";
import HeaderVariantTitleIconButton from "Features/layout/components/HeaderVariantTitleIconButton";
import IconButtonSyncScope from "./IconButtonSyncScope";

import ButtonUploadChanges from "./ButtonUploadChanges";

export default function SectionRemoteContainerConnected({
  remoteContainer,
  onDisconnexion,
}) {
  const dispatch = useDispatch();

  // data

  const {
    value: remoteToken,
    loading,
    remoteContainer: connectedRemoteContainer,
  } = useRemoteToken(remoteContainer);

  // helpers

  const name = remoteContainer?.name;

  // effect - store

  useEffect(() => {
    if (remoteToken) {
      console.log(
        "[localStorage] set remoteContainer",
        connectedRemoteContainer
      );
      setRemoteContainerInLocalStorage(connectedRemoteContainer);
      dispatch(setRemoteContainer(connectedRemoteContainer));
    }
  }, [remoteToken]);

  return (
    <Box>
      <HeaderVariantTitleIconButton
        title={name}
        iconButton={<IconButtonSyncScope />}
      />
      <ButtonUploadChanges />
      <Box sx={{bgcolor: "white"}}>
        {loading && (
          <Box sx={{width: 1}}>
            <BlockLoading />
          </Box>
        )}
        {!remoteToken && !loading && (
          <ButtonLoginRemoteContainer remoteContainer={remoteContainer} />
        )}
        {remoteToken && !loading && (
          <SectionRemoteContainerConnexion
            remoteContainer={remoteContainer}
            onDisconnexion={onDisconnexion}
          />
        )}
      </Box>
    </Box>
  );
}
