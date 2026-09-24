export const STAGES = ["VERY_WARM", "WARM", "MILD", "FRESH", "COOL", "COLD", "VERY_COLD", "ICY"] as const;
export type Stage = typeof STAGES[number];
export type Sun = "CLOUDY" | "PARTLY" | "SUNNY";
export type Personal = "COLD_SENSITIVE" | "NORMAL" | "RUNS_WARM";
export type Accessory = "none" | "optional" | "recommended";

export const STAGE_LABELS: Record<Stage, string> = {
  VERY_WARM: "Sehr warm", WARM: "Warm", MILD: "Mild", FRESH: "Frisch",
  COOL: "Kühl", COLD: "Kalt", VERY_COLD: "Sehr kalt", ICY: "Eisig",
};

const CLOTHING: Record<Stage, { recommended: string[]; optional: string[] }> = {
  VERY_WARM: { recommended: [], optional: ["Neoprenshirt kurzarm"] },
  WARM: { recommended: ["Neoprenshirt kurzarm"], optional: [] },
  MILD: { recommended: ["Neoprenshirt Langarm"], optional: [] },
  FRESH: { recommended: ["Neoprenshirt kurzarm", "Paddeljacke"], optional: [] },
  COOL: { recommended: ["Neoprenshirt Langarm", "Paddeljacke"], optional: [] },
  COLD: { recommended: ["LongJohn", "Neoprenshirt kurzarm", "Paddeljacke"], optional: [] },
  VERY_COLD: { recommended: ["LongJohn", "Neoprenshirt Langarm", "Paddeljacke"], optional: [] },
  ICY: { recommended: ["LongJohn", "Neoprenshirt Langarm", "Paddeljacke"], optional: [] },
};
export const ALWAYS_WORN = ["Neoprenschuhe", "Schwimmweste", "Spritzdecke", "Helm"];

const airColumn = (air: number) => air < 5 ? 0 : air < 10 ? 1 : air < 15 ? 2 : air < 20 ? 3 : air < 25 ? 4 : 5;

export function determineBaseLevel(water: number, air: number): Stage {
  const column = airColumn(air);
  if (water >= 20) return ["COOL", "FRESH", "FRESH", "MILD", "WARM", "VERY_WARM"][column] as Stage;
  if (water >= 18) return ["COOL", "COOL", "FRESH", "MILD", "WARM", "VERY_WARM"][column] as Stage;
  if (water >= 16) return ["COLD", "COOL", "COOL", "FRESH", "MILD", "WARM"][column] as Stage;
  if (water >= 14) return ["COLD", "COLD", "COOL", "FRESH", "MILD", "WARM"][column] as Stage;
  if (water >= 12) return air < 5 ? "VERY_COLD" : "COLD";
  if (water >= 10) return air < 10 ? "VERY_COLD" : "COLD";
  if (water >= 8) return air < 5 ? "ICY" : air < 20 ? "VERY_COLD" : "COLD";
  return air < 15 ? "ICY" : "VERY_COLD";
}

function shift(stage: Stage, amount: number): Stage {
  return STAGES[Math.max(0, Math.min(STAGES.length - 1, STAGES.indexOf(stage) + amount))];
}
export function applyWindCorrection(stage: Stage, wind: number) {
  const steps = wind >= 30 ? 2 : wind >= 20 ? 1 : 0;
  return { stage: shift(stage, steps), steps };
}
export function applySunCorrection(stage: Stage, sun: Sun, air: number, wind: number) {
  const steps = sun === "SUNNY" && wind < 10 && air >= 10 ? -1 : 0;
  return { stage: shift(stage, steps), steps };
}
export function applyPersonalCorrection(stage: Stage, personal: Personal) {
  const steps = personal === "COLD_SENSITIVE" ? 1 : personal === "RUNS_WARM" ? -1 : 0;
  return { stage: shift(stage, steps), steps };
}
export function applyColdWaterMinimum(stage: Stage, water: number) {
  const minimum: Stage | null = water >= 16 ? null : water >= 14 ? "FRESH" : water >= 8 ? "COLD" : "VERY_COLD";
  const finalStage = minimum && STAGES.indexOf(stage) < STAGES.indexOf(minimum) ? minimum : stage;
  return { stage: finalStage, minimum, changed: finalStage !== stage };
}
export function determineMainClothing(stage: Stage) { return CLOTHING[stage]; }

export function determineGloves(air: number, wind: number): Accessory {
  const base: Accessory = air < 5 ? "recommended" : air < 10 ? "optional" : "none";
  if (wind < 20 || base === "recommended") return base;
  return base === "none" ? "optional" : "recommended";
}
export function determineHood(water: number, air: number): Accessory {
  if (water > 15) return air >= 10 ? "none" : "optional";
  if (water >= 12) return air >= 15 ? "none" : air < 5 ? "recommended" : "optional";
  if (water >= 10) return air >= 20 ? "none" : air < 10 ? "recommended" : "optional";
  if (water >= 8) return air >= 15 ? "optional" : "recommended";
  return air >= 20 ? "optional" : "recommended";
}
function correctionText(steps: number) {
  return steps === 0 ? "keine Änderung" : `${Math.abs(steps) === 2 ? "zwei Stufen" : "eine Stufe"} ${steps > 0 ? "kälter" : "wärmer"}`;
}
export function generateExplanation(water: number, air: number, base: Stage, windSteps: number, sunSteps: number, personalSteps: number, minimumChanged: boolean, minimum: Stage | null) {
  const parts = [`${water.toLocaleString("de-DE")} °C Wasser und ${air.toLocaleString("de-DE")} °C Luft ergeben „${STAGE_LABELS[base]}“.`];
  if (windSteps) parts.push(`Wind: ${correctionText(windSteps)}.`);
  if (sunSteps) parts.push("Direkte Sonne: eine Stufe wärmer.");
  if (personalSteps) parts.push(`Dein Wärmeempfinden: ${correctionText(personalSteps)}.`);
  if (minimumChanged) parts.push(`Kaltes Wasser begrenzt die Empfehlung auf mindestens „${STAGE_LABELS[minimum!]}“.`);
  return parts.join(" ");
}
export function calculateClothing({ water, air, wind, sun, personal = "NORMAL" }: { water: number; air: number; wind: number; sun: Sun; personal?: Personal }) {
  const safeWater = Math.max(5, Math.min(22, water));
  const base = determineBaseLevel(safeWater, air);
  const afterWind = applyWindCorrection(base, wind);
  const afterSun = applySunCorrection(afterWind.stage, sun, air, wind);
  const afterPersonal = applyPersonalCorrection(afterSun.stage, personal);
  const final = applyColdWaterMinimum(afterPersonal.stage, safeWater);
  const main = determineMainClothing(final.stage);
  const gloves = determineGloves(air, wind);
  const hood = determineHood(safeWater, air);
  const recommended = [...main.recommended], optional = [...main.optional];
  if (gloves === "recommended") recommended.push("Neoprenhandschuhe");
  if (gloves === "optional") optional.push("Neoprenhandschuhe");
  if (hood === "recommended") recommended.push("Neoprenhaube");
  if (hood === "optional") optional.push("Neoprenhaube");
  return {
    stage: final.stage, stageLabel: STAGE_LABELS[final.stage], baseLabel: STAGE_LABELS[base],
    windText: correctionText(afterWind.steps), sunText: correctionText(afterSun.steps),
    personalText: correctionText(afterPersonal.steps),
    minimumText: final.minimum ? `mindestens ${STAGE_LABELS[final.minimum]}` : "keine Begrenzung",
    recommended, optional, gloves, hood, always: ALWAYS_WORN,
    explanation: generateExplanation(safeWater, air, base, afterWind.steps, afterSun.steps, afterPersonal.steps, final.changed, final.minimum),
  };
}
