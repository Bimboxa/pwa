import { useState, useEffect } from "react";

import { IconButton, Button, Box } from "@mui/material";
import { BugReport } from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import FieldTextV2 from "Features/form/components/FieldTextV2";
import BoxAlignToRight from "Features/layout/components/BoxAlignToRight";

import setDebugAuthInLocalStorage from "../services/setDebugAuthInLocalStorage";
import getDebugAuthFromLocalStorage from "../services/getDebugAuthFromLocalStorage";


export default function IconButtonDebugAuth() {


    // state

    const [open, setOpen] = useState(false);

    const [jwt, setJwt] = useState("");
    const [userIdMaster, setUserIdMaster] = useState("");
    const [userName, setUserName] = useState("");
    const [trigram, setTrigram] = useState("");

    // effect

    useEffect(() => {
        const { jwt, userIdMaster, userName, trigram } = getDebugAuthFromLocalStorage() ?? {};
        if (userIdMaster) {
            setUserIdMaster(userIdMaster);
        }
        if (jwt) {
            setJwt(jwt);
        }
        if (userName) {
            setUserName(userName);
        }
        if (trigram) {
            setTrigram(trigram)
        }
    }, []);

    // handlers

    function handleSave() {
        setDebugAuthInLocalStorage({ jwt, userIdMaster, userName, trigram });
        setOpen(false);
    }

    function handleCancel() {
        setOpen(false);
        setJwt("");
        setUserIdMaster("");
        setTrigram("");
    }

    return <>
        <IconButton onClick={() => setOpen(true)}>
            <BugReport sx={{ color: "grey.100" }} />
        </IconButton>
        <DialogGeneric
            open={open}
            onClose={handleCancel}
            title="Debug Auth"
            actions={
                <>
                    <Button onClick={handleCancel}>Annuler</Button>
                    <Button onClick={handleSave}>Enregistrer</Button>
                </>
            }
        >
            <FieldTextV2
                label="JWT"
                value={jwt}
                onChange={setJwt}
            />
            <FieldTextV2
                label="User ID Master"
                value={userIdMaster}
                onChange={setUserIdMaster}
            />
            <FieldTextV2
                label="User Name"
                value={userName}
                onChange={setUserName}
            />
            <FieldTextV2
                label="Trigramme"
                value={trigram}
                onChange={setTrigram}
            />

            <BoxAlignToRight sx={{ p: 1 }}>
                <Button onClick={handleSave}>Enregistrer</Button>
            </BoxAlignToRight>
        </DialogGeneric>
    </>


}