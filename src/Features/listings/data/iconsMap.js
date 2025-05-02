import {
  Pentagon,
  Comment,
  FormatColorFill,
  MeetingRoom,
  Troubleshoot,
  Info,
  LocationOn,
  OfflineBolt,
  ShoppingCart,
  DataObject,
  Map as MapIcon,
  Category,
  DocumentScanner as Document,
} from "@mui/icons-material";
import ExcelIcon from "Features/excel/utils/components/ExcelIcon";

const iconsMap = new Map();
iconsMap.set("pentagon", Pentagon);
iconsMap.set("comment", Comment);
iconsMap.set("room", MeetingRoom);
iconsMap.set("material", FormatColorFill);
iconsMap.set("sample", Troubleshoot);
iconsMap.set("info", Info);
iconsMap.set("location", LocationOn);
iconsMap.set("shoppingCart", ShoppingCart);
iconsMap.set("dataObject", DataObject);
iconsMap.set("map", MapIcon);
iconsMap.set("nomenclature", Category);
iconsMap.set("excel", ExcelIcon);

export default iconsMap;
