import {blue, orange} from "@mui/material/colors";

const exampleListingsMap = new Map();

const listing1 = {
  id: "listing1",
  name: "Locaux",
  color: blue[500],
  iconKey: "room",
  entityModelKey: "zone",
};

const listing2 = {
  id: "listing2",
  name: "Commentaires",
  color: orange[500],
  iconKey: "comment",
  entityModelKey: "comment",
};

exampleListingsMap.set(listing1.id, listing1);
exampleListingsMap.set(listing2.id, listing2);

export default exampleListingsMap;
