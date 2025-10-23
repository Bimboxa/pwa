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
  Share,
  ListAlt,
  Wallpaper,
  ShapeLine,
  Print,
  CenterFocusStrong,
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
iconsMap.set("share", Share);
iconsMap.set("legend", ListAlt);
iconsMap.set("blueprint", Print);
iconsMap.set("shapes", ShapeLine);
iconsMap.set("print", Print);
iconsMap.set("background", Wallpaper);
iconsMap.set("detail", CenterFocusStrong);
export default iconsMap;
