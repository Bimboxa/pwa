import testIsImage from "Features/files/utils/testIsImage";

export default class ProjectFile {
  // Public properties

  id;
  itemId;
  file;
  isImage;

  constructor({ file, itemId, itemField }) {
    this.id = `${itemField}_${itemId}`;
    this.itemId = itemId;
    this.file = file;
    this.isImage = testIsImage(file);
  }
}
