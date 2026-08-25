import type { Metadata } from "next";
import { SeedlingCalculator } from "../plantines/seedling-calculator";
import "../plantines/plantines.css";

export const metadata: Metadata = {
  title: "Estimación de plantines · Nube",
  description: "Calculadoras de plantines disponibles y proyección por ciclo.",
};

export default function SeedlingsPage() {
  return <SeedlingCalculator />;
}
