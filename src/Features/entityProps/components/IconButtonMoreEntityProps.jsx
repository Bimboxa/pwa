import {useState} from "react";

import {MoreHoriz} from "@mui/icons-material";
import IconButtonMenu from "Features/layout/components/IconButtonMenu";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import PanelCreateOption from "./PanelCreateOption";

export default function IconButtonMoreEntityProps() {
  // strings

  const manageOptionsLabel = "Voir les commandes";
  const createOptionLabel = "Créer une commande";

  // data

  const [openCreateOption, setOpenCreateOption] = useState(false);

  return (
    <>
      <DialogGeneric
        title={createOptionLabel}
        open={openCreateOption}
        onClose={() => setOpenCreateOption(false)}
      >
        <PanelCreateOption
          onSaved={() => setOpenCreateOption(false)}
          onCancelled={() => setOpenCreateOption(false)}
        />
      </DialogGeneric>
      <IconButtonMenu
        icon={<MoreHoriz />}
        actions={[
          {
            label: createOptionLabel,
            handler: () => setOpenCreateOption(true),
          },
        ]}
      />
    </>
  );
}
