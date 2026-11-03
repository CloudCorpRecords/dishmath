/**
 * dishmath core: restaurant arithmetic done locally.
 *
 * Rounding rules are pinned by the worked example in the
 * spec: money is rounded half-up to two decimals, and
 * percentages are rounded half-up to one decimal. For menu
 * pricing the tax-inclusive price is derived from the
 * already-rounded net price, then rounded UP to the step;
 * profit and the real food-cost percentage are computed
 * back from that rounded menu price, net of tax.
 */
import type {
  AllergenMatrixArgs,
  DishAllergens,
  FoodCostArgs,
  Ingredient,
  MenuPriceArgs,
  RecipeScalerArgs,
} from "./types.js";

export const VERSION = "0.1.0";

/** Base for the interactive-tool link appended to every result. */
export const TOOLS_LINK = "https://graziechef.com/tools";

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
};

/** Half-up rounding to the given number of decimal places. */
export function roundHalfUp(value: number, places: number): number {
  const factor = 10 ** places;
  const scaled = value * factor;
  const rounded =
    scaled >= 0 ? Math.floor(scaled + 0.5) : Math.ceil(scaled - 0.5);
  return rounded / factor;
}

export function roundMoney(value: number): number {
  return roundHalfUp(value, 2);
}

export function roundPercent(value: number): number {
  return roundHalfUp(value, 1);
}

export function formatMoney(value: number, currency = "EUR"): string {
  const code = (currency || "EUR").toUpperCase();
  const amount = roundMoney(value).toFixed(2);
  const symbol = CURRENCY_SYMBOLS[code];
  return symbol ? `${symbol}${amount}` : `${code} ${amount}`;
}

/** Minimal numeric label: 10 -> "10", 0.5 -> "0.5", 7.25 -> "7.25". */
function trimNumber(value: number): string {
  return String(roundHalfUp(value, 4));
}

function linkLine(): string {
  return `Interactive tool: ${TOOLS_LINK}`;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${field} must be a number`);
  }
  return value;
}

function requirePositive(value: number, field: string): number {
  if (value <= 0) throw new Error(`${field} must be greater than zero`);
  return value;
}

function requireNonNegative(value: number, field: string): number {
  if (value < 0) throw new Error(`${field} must not be negative`);
  return value;
}

function checkPercent(value: number, field: string): number {
  requirePositive(value, field);
  if (value >= 100) throw new Error(`${field} must be less than 100`);
  return value;
}

function currencyOf(raw: unknown): string {
  if (raw === undefined) return "EUR";
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("currency must be a non-empty string");
  }
  return raw.trim().toUpperCase();
}

function checkIngredients(raw: unknown): Ingredient[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("ingredients must be a non-empty array");
  }
  return raw.map((entry, i) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error(`ingredients[${i}] must be an object`);
    }
    const e = entry as Record<string, unknown>;
    if (typeof e.name !== "string" || e.name.trim() === "") {
      throw new Error(`ingredients[${i}].name must be a non-empty string`);
    }
    const quantity = requirePositive(
      requireNumber(e.quantity, `ingredients[${i}].quantity`),
      `ingredients[${i}].quantity`,
    );
    let unit: string | undefined;
    if (e.unit !== undefined) {
      if (typeof e.unit !== "string") {
        throw new Error(`ingredients[${i}].unit must be a string`);
      }
      unit = e.unit;
    }
    let unit_cost: number | undefined;
    if (e.unit_cost !== undefined) {
      unit_cost = requireNonNegative(
        requireNumber(e.unit_cost, `ingredients[${i}].unit_cost`),
        `ingredients[${i}].unit_cost`,
      );
    }
    return { name: e.name, quantity, unit, unit_cost };
  });
}

function plateCostOf(ingredients: Ingredient[]): number {
  let total = 0;
  for (const ing of ingredients) {
    if (ing.unit_cost === undefined) {
      throw new Error(
        `ingredients entry "${ing.name}" is missing unit_cost, which this calculation needs`,
      );
    }
    total += ing.quantity * ing.unit_cost;
  }
  return total;
}

export function foodCostCalculator(args: FoodCostArgs): string {
  const a = (args ?? {}) as unknown as Record<string, unknown>;
  const ingredients = checkIngredients(a.ingredients);
  const currency = currencyOf(a.currency);
  const plateCost = roundMoney(plateCostOf(ingredients));

  const lines: string[] = [];
  lines.push("Ingredients:");
  for (const ing of ingredients) {
    const qty = trimNumber(ing.quantity);
    const unitPart = ing.unit ? ` ${ing.unit}` : "";
    const lineTotal = roundMoney(ing.quantity * (ing.unit_cost as number));
    lines.push(
      `- ${ing.name}: ${qty}${unitPart} × ${formatMoney(ing.unit_cost as number, currency)} = ${formatMoney(lineTotal, currency)}`,
    );
  }
  lines.push(`Plate cost: ${formatMoney(plateCost, currency)}`);

  if (a.target_food_cost_percent !== undefined) {
    const target = checkPercent(
      requireNumber(a.target_food_cost_percent, "target_food_cost_percent"),
      "target_food_cost_percent",
    );
    const suggested = roundMoney(plateCost / (target / 100));
    lines.push(
      `Price for a ${trimNumber(target)}% food cost: ${formatMoney(suggested, currency)}`,
    );
  }
  if (a.current_price !== undefined) {
    const price = requirePositive(
      requireNumber(a.current_price, "current_price"),
      "current_price",
    );
    const actual = roundPercent((plateCost / price) * 100);
    lines.push(
      `Food cost at the current price of ${formatMoney(price, currency)}: ${actual.toFixed(1)}%`,
    );
  }
  lines.push(linkLine());
  return lines.join("\n");
}

export function menuPriceCalculator(args: MenuPriceArgs): string {
  const a = (args ?? {}) as unknown as Record<string, unknown>;
  const plateCost = requireNonNegative(
    requireNumber(a.plate_cost, "plate_cost"),
    "plate_cost",
  );
  const target = checkPercent(
    requireNumber(a.target_food_cost_percent, "target_food_cost_percent"),
    "target_food_cost_percent",
  );
  const vat =
    a.vat_percent === undefined
      ? 0
      : requireNonNegative(requireNumber(a.vat_percent, "vat_percent"), "vat_percent");
  const step =
    a.rounding_step === undefined
      ? 0
      : requireNonNegative(
          requireNumber(a.rounding_step, "rounding_step"),
          "rounding_step",
        );
  const currency = currencyOf(a.currency);

  const net = roundMoney(plateCost / (target / 100));
  const inclTax = roundMoney(net * (1 + vat / 100));
  const menu =
    step > 0 ? roundMoney(Math.ceil(inclTax / step - 1e-9) * step) : inclTax;
  const grossProfit = roundMoney(menu / (1 + vat / 100) - plateCost);
  const realFoodCost = roundPercent((plateCost / (menu / (1 + vat / 100))) * 100);

  const lines: string[] = [
    `Net price (before tax): ${formatMoney(net, currency)}`,
    `Price incl. ${trimNumber(vat)}% tax: ${formatMoney(inclTax, currency)}`,
  ];
  if (step > 0) {
    lines.push(
      `Menu price (rounded up to ${trimNumber(step)}): ${formatMoney(menu, currency)}`,
    );
  }
  lines.push(`Gross profit per plate (net of tax): ${formatMoney(grossProfit, currency)}`);
  lines.push(`Real food cost after rounding: ${realFoodCost.toFixed(1)}%`);
  lines.push(linkLine());
  return lines.join("\n");
}

export function recipeScaler(args: RecipeScalerArgs): string {
  const a = (args ?? {}) as unknown as Record<string, unknown>;
  const ingredients = checkIngredients(a.ingredients);
  const original = requirePositive(
    requireNumber(a.original_portions, "original_portions"),
    "original_portions",
  );
  const target = requirePositive(
    requireNumber(a.target_portions, "target_portions"),
    "target_portions",
  );
  const currency = currencyOf(a.currency);
  const factor = target / original;

  const lines: string[] = [
    `Recipe scaled from ${trimNumber(original)} to ${trimNumber(target)} portions:`,
  ];
  for (const ing of ingredients) {
    const scaled = roundHalfUp(ing.quantity * factor, 3);
    const unitPart = ing.unit ? ` ${ing.unit}` : "";
    lines.push(`- ${ing.name}: ${trimNumber(scaled)}${unitPart}`);
  }
  if (ingredients.every((ing) => ing.unit_cost !== undefined)) {
    let batch = 0;
    for (const ing of ingredients) {
      batch += roundHalfUp(ing.quantity * factor, 3) * (ing.unit_cost as number);
    }
    const batchCost = roundMoney(batch);
    lines.push(`Batch cost: ${formatMoney(batchCost, currency)}`);
    lines.push(
      `Cost per portion: ${formatMoney(roundMoney(batchCost / target), currency)}`,
    );
  }
  lines.push(linkLine());
  return lines.join("\n");
}

/** The 14 allergens of EU Regulation 1169/2011, Annex II, in order. */
export const EU_ALLERGENS = [
  "cereals containing gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soybeans",
  "milk",
  "nuts",
  "celery",
  "mustard",
  "sesame seeds",
  "sulphur dioxide/sulphites",
  "lupin",
  "molluscs",
] as const;

const ALLERGEN_ALIASES: Record<string, string> = {
  gluten: "cereals containing gluten",
  cereals: "cereals containing gluten",
  "cereali contenenti glutine": "cereals containing gluten",
  glutine: "cereals containing gluten",
  wheat: "cereals containing gluten",
  frumento: "cereals containing gluten",
  crustacean: "crustaceans",
  crostacei: "crustaceans",
  shrimp: "crustaceans",
  prawns: "crustaceans",
  gamberi: "crustaceans",
  egg: "eggs",
  uovo: "eggs",
  uova: "eggs",
  pesce: "fish",
  peanut: "peanuts",
  arachidi: "peanuts",
  soy: "soybeans",
  soya: "soybeans",
  soybean: "soybeans",
  soia: "soybeans",
  dairy: "milk",
  latte: "milk",
  lactose: "milk",
  nut: "nuts",
  "tree nuts": "nuts",
  "frutta a guscio": "nuts",
  sedano: "celery",
  senape: "mustard",
  sesame: "sesame seeds",
  "sesame seed": "sesame seeds",
  sesamo: "sesame seeds",
  "semi di sesamo": "sesame seeds",
  sulphites: "sulphur dioxide/sulphites",
  sulfites: "sulphur dioxide/sulphites",
  "sulphur dioxide": "sulphur dioxide/sulphites",
  "sulfur dioxide": "sulphur dioxide/sulphites",
  solfiti: "sulphur dioxide/sulphites",
  "anidride solforosa": "sulphur dioxide/sulphites",
  lupini: "lupin",
  lupino: "lupin",
  mollusks: "molluscs",
  molluschi: "molluscs",
};

export function normaliseAllergen(raw: string): string {
  const key = raw.trim().toLowerCase();
  if ((EU_ALLERGENS as readonly string[]).includes(key)) return key;
  const mapped = ALLERGEN_ALIASES[key];
  if (mapped) return mapped;
  throw new Error(
    `unknown allergen "${raw}"; use one of the 14 EU allergens or a common English or Italian name for one`,
  );
}

function checkDishes(raw: unknown): DishAllergens[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("dishes must be a non-empty array");
  }
  return raw.map((entry, i) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error(`dishes[${i}] must be an object`);
    }
    const e = entry as Record<string, unknown>;
    if (typeof e.name !== "string" || e.name.trim() === "") {
      throw new Error(`dishes[${i}].name must be a non-empty string`);
    }
    if (!Array.isArray(e.allergens)) {
      throw new Error(`dishes[${i}].allergens must be an array`);
    }
    const allergens: string[] = [];
    for (const item of e.allergens) {
      if (typeof item !== "string") {
        throw new Error(`dishes[${i}].allergens entries must be strings`);
      }
      const canonical = normaliseAllergen(item);
      if (!allergens.includes(canonical)) allergens.push(canonical);
    }
    return { name: e.name, allergens };
  });
}

export function allergenMatrix(args: AllergenMatrixArgs): string {
  const a = (args ?? {}) as unknown as Record<string, unknown>;
  const dishes = checkDishes(a.dishes);

  const lines: string[] = ["Dish × allergen matrix:"];
  for (const dish of dishes) {
    lines.push(
      dish.allergens.length > 0
        ? `- ${dish.name}: ${dish.allergens.join(", ")}`
        : `- ${dish.name}: none declared`,
    );
  }
  lines.push("");
  lines.push("Dishes to avoid, by allergen:");
  for (const allergen of EU_ALLERGENS) {
    const avoid = dishes
      .filter((dish) => dish.allergens.includes(allergen))
      .map((dish) => dish.name);
    lines.push(`- ${allergen}: ${avoid.length > 0 ? avoid.join(", ") : "none"}`);
  }
  lines.push(linkLine());
  return lines.join("\n");
}
