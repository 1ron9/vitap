let credentials: { access?: string; guest?: string } = {};
let generation = 0;
export function getCredentials() {
  return { ...credentials };
}
export function getGeneration() {
  return generation;
}
export function setCredentials(tokens: { access?: string; guest?: string }, sameSession = false) {
  if (tokens.access && tokens.guest) throw new Error("AMBIGUOUS_PRINCIPAL");
  if (!sameSession) generation++;
  credentials = { ...tokens };
}
