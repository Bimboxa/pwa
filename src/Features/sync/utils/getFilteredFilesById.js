import extractKeyFromTemplate from "Features/misc/utils/extractKeyFromTemplate";

export default function getFilteredFilesById(files, filterFilesById) {
  // edge case
  if (!files || !filterFilesById) return;

  // helpers
  const template = filterFilesById.template;
  const _in = filterFilesById.in;

  // main
  return files.filter((file) => {
    return _in.includes(extractKeyFromTemplate(file.name, template, "id"));
  });
}
