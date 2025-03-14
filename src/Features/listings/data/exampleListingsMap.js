import {blue, orange} from "@mui/material/colors";

const exampleListingsMap = new Map();

const listing1 = {
  id: "listing1",
  entityModelKey: "zone",
  name: "Locaux",
  color: blue[500],
  iconKey: "room",
};

const listing2 = {
  id: "listing2",
  entityModelKey: "comment",
  name: "Commentaires",
  color: orange[500],
  iconKey: "comment",
};

exampleListingsMap.set(listing1.id, listing1);
exampleListingsMap.set(listing2.id, listing2);

export default exampleListingsMap;
