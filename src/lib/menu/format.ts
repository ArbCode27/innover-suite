export const formatRemovedIngredientsNote = (removedNames: string[]) => {
  const names = removedNames.map((name) => name.trim()).filter(Boolean);
  if (!names.length) return "";
  return `Sin: ${names.join(", ")}`;
};
