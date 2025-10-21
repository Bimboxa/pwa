import { nanoid } from "@reduxjs/toolkit";

import uploadMediaServiceV2 from "Features/sync/services/uploadMediaServiceV2";
import createKrtoFile from "Features/krtoFile/services/createKrtoFile";

export default async function createKrtoVersionService({
  orgaCode,
  projectId,
  label,
  author,
  description,
}) {
  const id = nanoid();

  const krtoFile = await createKrtoFile(projectId, {
    zip: true,
    nameFileWithTimestamp: true,
  });

  const metadata = {
    label,
    author,
    description,
  };

  const response = await uploadMediaServiceV2({
    id,
    file: krtoFile,
    typeCode: "krtoVersions",
    projectId,
    orgaCode,
    metadata: metadata,
  });

  return response;
}
