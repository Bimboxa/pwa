import { useState } from "react";

import { Box, Button, TextField, Typography } from "@mui/material";

import {
  verifyEmailDomain,
  requestEmailOtp,
  verifyEmailOtp,
  loginWithDemoCode,
} from "../services/notesAppAuthService";

export default function SectionNotesAppLoginForm({ appName = "Krnet" }) {
  // strings

  const introS = `Connectez-vous à ${appName} pour accéder à vos dossiers.`;
  const emailLabelS = "Email";
  const sendCodeS = "Recevoir un code";
  const otpLabelS = "Code reçu par email";
  const verifyS = "Valider";
  const demoLabelS = "Code démo";
  const demoHelperS = "Format : XXXX-XXXX";
  const useDemoS = "J'ai un code démo";
  const useEmailS = "Utiliser mon email";
  const backS = "Retour";

  // state

  const [step, setStep] = useState("email"); // email | otp | demo
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // helpers

  const formatDemoCode = (raw) => {
    const clean = raw
      .replace(/[^A-Z0-9]/gi, "")
      .toUpperCase()
      .slice(0, 8);
    return clean.match(/.{1,4}/g)?.join("-") ?? "";
  };

  // handlers

  async function handleEmailSubmit() {
    const raw = email.trim();
    setError(null);

    // a demo code typed in the email field is auto-detected
    const asCode = raw.replace(/[\s-]/g, "").toUpperCase();
    if (!raw.includes("@") && /^[A-Z0-9]{8}$/.test(asCode)) {
      setDemoCode(formatDemoCode(asCode));
      setStep("demo");
      await handleDemoSubmit(asCode);
      return;
    }

    const trimmed = raw.toLowerCase();
    if (!trimmed.includes("@")) {
      setError("Veuillez saisir un email valide.");
      return;
    }

    setLoading(true);
    try {
      const allowed = await verifyEmailDomain(trimmed);
      if (!allowed) {
        setError(
          `Le domaine "${trimmed.split("@")[1]}" n'est pas autorisé sur ${appName}.`
        );
        return;
      }
      await requestEmailOtp(trimmed);
      setStep("otp");
    } catch (e) {
      setError(e.message ?? "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit() {
    setError(null);
    setLoading(true);
    try {
      await verifyEmailOtp({ email, token: otp });
      // session propagates via onAuthStateChange -> slice
    } catch (e) {
      setError(e.message ?? "Code invalide.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoSubmit(codeArg) {
    const normalized = (codeArg ?? demoCode).replace(/[\s-]/g, "").toUpperCase();
    setError(null);
    if (normalized.length !== 8) {
      setError("Le code démo contient 8 caractères.");
      return;
    }
    setLoading(true);
    try {
      await loginWithDemoCode(normalized);
    } catch (e) {
      setError(e.message ?? "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  // render

  return (
    <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography variant="body2" color="text.secondary">
        {introS}
      </Typography>

      {step === "email" && (
        <>
          <TextField
            size="small"
            fullWidth
            label={emailLabelS}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleEmailSubmit()}
            autoFocus
          />
          <Button
            variant="contained"
            fullWidth
            onClick={handleEmailSubmit}
            loading={loading}
          >
            {sendCodeS}
          </Button>
          <Button size="small" onClick={() => setStep("demo")}>
            {useDemoS}
          </Button>
        </>
      )}

      {step === "otp" && (
        <>
          <Typography variant="caption" color="text.secondary">
            {email}
          </Typography>
          <TextField
            size="small"
            fullWidth
            label={otpLabelS}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && handleOtpSubmit()}
            autoFocus
          />
          <Button
            variant="contained"
            fullWidth
            onClick={handleOtpSubmit}
            loading={loading}
            disabled={otp.length !== 6}
          >
            {verifyS}
          </Button>
          <Button size="small" onClick={() => setStep("email")}>
            {backS}
          </Button>
        </>
      )}

      {step === "demo" && (
        <>
          <TextField
            size="small"
            fullWidth
            label={demoLabelS}
            helperText={demoHelperS}
            value={demoCode}
            onChange={(e) => setDemoCode(formatDemoCode(e.target.value))}
            onKeyDown={(e) => e.key === "Enter" && handleDemoSubmit()}
            autoFocus
          />
          <Button
            variant="contained"
            fullWidth
            onClick={() => handleDemoSubmit()}
            loading={loading}
          >
            {verifyS}
          </Button>
          <Button size="small" onClick={() => setStep("email")}>
            {useEmailS}
          </Button>
        </>
      )}

      {error && (
        <Typography variant="caption" color="error">
          {error}
        </Typography>
      )}
    </Box>
  );
}
