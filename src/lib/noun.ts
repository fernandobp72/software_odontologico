// Cómo llama cada organización a su centro. Se guarda la clave y aquí salen las formas con su artículo.
export const NOUNS = {
  consultorio: { name: "consultorio", Name: "Consultorio", el: "el", El: "El", del: "del", al: "al" },
  clinica: { name: "clínica", Name: "Clínica", el: "la", El: "La", del: "de la", al: "a la" },
  centro: { name: "centro odontológico", Name: "Centro odontológico", el: "el", El: "El", del: "del", al: "al" },
} as const;

export type NounKey = keyof typeof NOUNS;
export const nounOf = (key: string | null | undefined) => NOUNS[(key as NounKey) in NOUNS ? (key as NounKey) : "consultorio"];
