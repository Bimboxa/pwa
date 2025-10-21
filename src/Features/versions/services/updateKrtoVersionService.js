import uploadMediaServiceV2 from "Features/sync/services/uploadMediaServiceV2";
import createKrtoFile from "Features/krtoFile/services/createKrtoFile";

export default async function updateKrtoVersionService({
  id,
  orgaCode,
  projectId,
  label,
  author,
  description,
}) {
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
    metadata,
  });

  return response;
}
