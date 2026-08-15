export type PackageName = "Mini" | "Nube" | "Fiestón";
export type PartyPackage = { name: PackageName; eyebrow: string; price: number; features: string[]; popular?: boolean };
export type Extra = { name: string; price: number };

export const packages: PartyPackage[] = [
  { name: "Mini", eyebrow: "Para festejos íntimos", price: 18900, features: ["Hasta 15 niños", "2 horas y media", "Merienda clásica", "1 animador", "Invitación digital"] },
  { name: "Nube", eyebrow: "La fiesta completa", price: 27900, popular: true, features: ["Hasta 25 niños", "3 horas", "Merienda completa", "2 animadores", "Taller creativo", "Torta personalizada"] },
  { name: "Fiestón", eyebrow: "Para tirar la casa por la ventana", price: 38900, features: ["Hasta 35 niños", "3 horas y media", "Menú premium", "3 animadores", "Show temático", "Foto y video"] }
];

export const extras: Extra[] = [
  { name: "Decoración temática", price: 4500 }, { name: "Fotografía", price: 3200 }, { name: "Candy bar", price: 2800 }
];
export const money = (value: number) => `$${value.toLocaleString("es-UY")}`;
