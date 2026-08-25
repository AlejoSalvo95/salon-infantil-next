export type PackageName = "Mini" | "Nube" | "Fiestón";
export type PartyPackage = { name: PackageName; eyebrow: string; price: number; features: string[]; popular?: boolean };
export type Extra = { name: string; price: number };
export const packageDisplayName = (name: PackageName) => name === "Fiestón" ? "Grand Garden" : name === "Nube" ? "Cloud Garden" : "Mini Garden";

export const packages: PartyPackage[] = [
  { name: "Mini", eyebrow: "For small groups", price: 18900, features: ["Up to 15 young growers", "2.5 hours", "Classic garden snack", "1 garden guide", "Digital invitation"] },
  { name: "Nube", eyebrow: "The complete garden program", price: 27900, popular: true, features: ["Up to 25 young growers", "3 hours", "Full garden snack", "2 garden guides", "Botanical workshop", "Custom cake"] },
  { name: "Fiestón", eyebrow: "For a full garden celebration", price: 38900, features: ["Up to 35 young growers", "3.5 hours", "Premium garden menu", "3 garden guides", "Botanical show", "Photo and video"] }
];

export const extras: Extra[] = [
  { name: "Botanical decoration", price: 4500 }, { name: "Photography", price: 3200 }, { name: "Candy bar", price: 2800 }
];
export const money = (value: number) => `$${value.toLocaleString("en-US")}`;
