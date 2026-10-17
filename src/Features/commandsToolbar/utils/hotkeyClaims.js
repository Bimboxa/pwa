// Plain letters currently claimed by the enabled commands of the toolbar
// (published by useCommandsHotkeys on every render). Other plain-letter
// listeners (useRightPanelToolHotkeys: E Élévation, A Chat…) yield on a
// claimed letter, so listener registration order never decides who wins.
let claimedLetters = new Set();

export function setClaimedLetters(letters) {
  claimedLetters = new Set(letters);
}

export function isLetterClaimed(letter) {
  return claimedLetters.has(String(letter).toLowerCase());
}
