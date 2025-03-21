import {useSelector} from "react-redux";
import useCredentialsMetadata from "../hooks/useCredentialsMetadata";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import {Typography, Box} from "@mui/material";

import BlockEditableServiceCredential from "./BlockEditableServiceCredential";

export default function PageServicesCredentials() {
  const title = "Clés sécurisées";

  // data

  const credentialsMetadata = useCredentialsMetadata();
  const servicesCredentialsMap = useSelector(
    (state) => state.servicesCredentials.servicesCredentialsMap
  );

  // helpers

  const servicesCredentials = credentialsMetadata?.map((metadata) => {
    return {
      ...metadata,
      value: servicesCredentialsMap[metadata.key]?.value,
    };
  });

  return (
    <BoxFlexVStretch>
      <Box
        sx={{width: 1, pb: 2, mb: 2, borderBottom: 1, borderColor: "divider"}}
      >
        <Typography sx={{fontWeight: "bold"}}>{title}</Typography>
      </Box>

      {servicesCredentials.map((serviceCredential) => {
        return (
          <BlockEditableServiceCredential
            key={serviceCredential.key}
            serviceCredential={serviceCredential}
          />
        );
      })}
    </BoxFlexVStretch>
  );
}
