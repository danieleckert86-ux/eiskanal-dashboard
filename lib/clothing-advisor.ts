export const STAGES = ["VERY_WARM", "WARM", "MILD", "FRESH", "COOL", "COLD", "VERY_COLD", "ICY"] as const;
export type Stage = typeof STAGES[number];
export type Sun = "CLOUDY" | "PARTLY" | "SUNNY";

export const STAGE_LABELS: Record<Stage, string> = {
  VERY_WARM: "Sehr warm",
  WARM: "Warm",
  MILD: "Mild",
  FRESH: "Frisch",
  COOL: "Kühl",
  COLD: "Kalt",
  VERY_COLD: "Sehr kalt",
  ICY: "Eisig",
};

const CLOTHING: Record<Stage, { recommended: string[]; optional: string[] }> = {
  VERY_WARM: { recommended: ["Neoprenshirt kurzarm"], optional: [] },
  WARM: { recommended: ["Neoprenshirt kurzarm"], optional: [] },
  MILD: { recommended: ["Neoprenshirt Langarm"], optional: [] },
  FRESH: { recommended: ["Neoprenshirt kurzarm", "Semidry-Paddeljacke"], optional: [] },
  COOL: { recommended: ["Neoprenshirt Langarm", "Semidry-Paddeljacke"], optional: [] },
  COLD: { recommended: ["LongJohn", "Neoprenshirt kurzarm", "Semidry-Paddeljacke"], optional: ["Neoprenhandschuhe", "Neoprenhaube"] },
  VERY_COLD: { recommended: ["LongJohn", "Neoprenshirt Langarm", "Semidry-Paddeljacke"], optional: ["Neoprenhandschuhe", "Neoprenhaube"] },
  ICY: { recommended: ["LongJohn", "Neoprenshirt Langarm", "Semidry-Paddeljacke", "Neoprenhandschuhe", "Neoprenhaube"], optional: [] },
};

export const ALWAYS_WORN = ["Neoprenschuhe", "Schwimmweste", "Spritzdecke", "Helm"];

function fromAir(air: number, stages: Stage[]) {
  if (stages.length === 2) return air < 5 ? stages[0] : stages[1];
  const index = air < 5 ? 0 : air < 10 ? 1 : air < 15 ? 2 : air < 20 ? 3 : air < 25 ? 4 : 5;
  return stages[index];
}

export function baseStage(water: number, air: number): Stage {
  if (water >= 20) return fromAir(air, ["COOL", "FRESH", "FRESH", "MILD", "WARM", "VERY_WARM"]);
  if (water >= 18) return fromAir(air, ["COOL", "COOL", "FRESH", "MILD", "WARM", "VERY_WARM"]);
  if (water >= 16) return fromAir(air, ["COLD", "COOL", "COOL", "FRESH", "MILD", "WARM"]);
  if (water >= 14) return fromAir(air, ["COLD", "COLD", "COOL", "FRESH", "MILD", "WARM"]);
  if (water >= 12) return fromAir(air, ["VERY_COLD", "COLD"]);
  if (water >= 10) return air < 10 ? "VERY_COLD" : "COLD";
  if (water >= 8) return air < 5 ? "ICY" : air < 20 ? "VERY_COLD" : "COLD";
  return air < 15 ? "ICY" : "VERY_COLD";
}

function shift(stage: Stage, amount: number) {
  return STAGES[Math.max(0, Math.min(STAGES.length - 1, STAGES.indexOf(stage) + amount))];
}

function waterMinimum(water: number): Stage | null {
  if (water >= 16) return null;
  if (water >= 14) return "FRESH";
  if (water >= 8) return "COLD";
  return "VERY_COLD";
}

export function calculateClothing({ water, air, wind, sun }: { water: number; air: number; wind: number; sun: Sun }) {
  const safeWater = Math.max(5, Math.min(22, water));
  const base = baseStage(safeWater, air);
  const windShift = wind >= 30 ? 2 : wind >= 20 ? 1 : 0;
  const afterWind = shift(base, windShift);
  const sunShift = sun === "SUNNY" && wind < 10 && air >= 10 ? -1 : 0;
  const afterSun = shift(afterWind, sunShift);
  const minimum = waterMinimum(safeWater);
  const finalStage = minimum && STAGES.indexOf(afterSun) < STAGES.indexOf(minimum) ? minimum : afterSun;
  const clothing = CLOTHING[finalStage];
  const minimumChanged = finalStage !== afterSun;
  const explanation = `${safeWater.toLocaleString("de-DE")} °C Wasser und ${air.toLocaleString("de-DE")} °C Luft ergeben zunächst „${STAGE_LABELS[base]}“. ${windShift ? `Der Wind verschiebt die Einstufung um ${windShift === 1 ? "eine Stufe" : "zwei Stufen"} Richtung kalt.` : "Der Wind verändert die Einstufung nicht."} ${sunShift ? "Direkte Sonne und wenig Wind verschieben sie um eine Stufe Richtung warm." : "Die Sonne verändert die Einstufung nicht."}${minimumChanged ? ` Wegen der Wassertemperatur gilt abschließend mindestens „${STAGE_LABELS[minimum!]}“.` : ""}`;
  return {
    stage: finalStage,
    stageLabel: STAGE_LABELS[finalStage],
    base,
    baseLabel: STAGE_LABELS[base],
    windText: windShift === 0 ? "keine Änderung" : windShift === 1 ? "eine Stufe kälter" : "zwei Stufen kälter",
    sunText: sunShift ? "eine Stufe wärmer" : "keine Änderung",
    minimum,
    minimumText: minimum ? `mindestens ${STAGE_LABELS[minimum]}` : "keine Änderung",
    minimumChanged,
    recommended: clothing.recommended,
    optional: clothing.optional,
    always: ALWAYS_WORN,
    explanation,
  };
}
