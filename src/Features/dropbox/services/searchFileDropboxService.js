import createDbx from "./createDbx";

export default async function searchFileDropboxService({
  fileName,
  accessToken,
}) {
  const dbx = createDbx({accessToken});
  const response = await dbx.filesSearchV2({
    query: fileName,
    options: {filename_only: true, max_results: 1},
  });
  console.log(
    "[searchFileDropboxService] search filename",
    fileName,
    response?.result
  );

  const matches = response?.result?.matches;

  const match0 = matches?.[0];

  if (match0) {
    console.log("debug_2005 find file", match0);
    return match0;
  }
}
