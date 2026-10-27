import { useEffect, useState } from "react";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box } from "@mui/material";

import getStartingVocabulary from "../utils/getStartingVocabulary";

// Step « 0 » of the countdown: a black screen where « GO » and the app name
// alternate, blinking, with a stereoscopic (anaglyph) red / cyan fringe.
const WORD_MS = 900;

export default function SectionGo() {
  // data

  const appConfig = useAppConfig();

  // strings

  const goS = "GO";
  const { appName } = getStartingVocabulary(appConfig);
  const words = [goS, appName.toUpperCase()];

  // state

  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % words.length),
      WORD_MS
    );
    return () => clearInterval(timer);
  }, [words.length]);

  // render

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "common.black",
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      <Box
        key={index}
        sx={{
          position: "relative",
          color: "white",
          fontWeight: 900,
          fontSize: "clamp(96px, 22vw, 320px)",
          lineHeight: 1,
          letterSpacing: "0.06em",
          animation: `startingGoBlink ${WORD_MS}ms steps(1, end) 1`,
          "@keyframes startingGoBlink": {
            "0%": { opacity: 1 },
            "55%": { opacity: 1 },
            "62%": { opacity: 0 },
            "70%": { opacity: 1 },
            "80%": { opacity: 0 },
            "88%": { opacity: 1 },
            "100%": { opacity: 1 },
          },
          // anaglyph fringes: a red copy to the left, a cyan one to the right
          "&::before, &::after": {
            content: "attr(data-word)",
            position: "absolute",
            top: 0,
            left: 0,
            mixBlendMode: "screen",
            animation: "startingGoShift 1.8s ease-in-out infinite",
          },
          "&::before": {
            color: "#ff2a2a",
            "--shift": "-1",
          },
          "&::after": {
            color: "#2af5ff",
            "--shift": "1",
            animationDelay: "-0.9s",
          },
          "@keyframes startingGoShift": {
            "0%, 100%": {
              transform: "translateX(calc(var(--shift) * 0.03em))",
            },
            "50%": { transform: "translateX(calc(var(--shift) * 0.09em))" },
          },
        }}
        data-word={words[index]}
      >
        {words[index]}
      </Box>
    </Box>
  );
}
