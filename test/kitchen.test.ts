import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  allergenMatrix,
  foodCostCalculator,
  formatMoney,
  menuPriceCalculator,
  normaliseAllergen,
  recipeScaler,
  roundHalfUp,
  roundMoney,
  roundPercent,
} from "../src/kitchen.js";

/**
 * Fixture arithmetic only: no network is involved anywhere
 * in this tool. The menu-price worked example is the
 * spec's pinned oracle and is asserted digit for digit.
 */

describe("rounding helpers", () => {
  it("rounds money half-up to two decimals", () => {
    assert.equal(roundMoney(10.6666667), 10.67);
    assert.equal(roundMoney(11.737), 11.74);
    assert.equal(roundMoney(2.005), 2.01);
    assert.equal(roundMoney(7.70909), 7.71);
  });

  it("rounds percentages half-up to one decimal", () => {
    assert.equal(roundPercent(29.33333), 29.3);
    assert.equal(roundPercent(29.35), 29.4);
  });

  it("roundHalfUp handles a plain half away from zero", () => {
    assert.equal(roundHalfUp(0.125, 2), 0.13);
    assert.equal(roundHalfUp(-0.125, 2), -0.13);
  });

  it("formats EUR with the euro sign and other codes by symbol or prefix", () => {
    assert.equal(formatMoney(10.67), "€10.67");
    assert.equal(formatMoney(10.67, "USD"), "$10.67");
    assert.equal(formatMoney(10.67, "CHF"), "CHF 10.67");
  });
});

describe("menu_price_calculator", () => {
  it("matches the pinned worked example digit for digit", () => {
    const out = menuPriceCalculator({
      plate_cost: 3.2,
      target_food_cost_percent: 30,
      vat_percent: 10,
      rounding_step: 0.5,
    });
    const lines = out.split("\n");
    assert.equal(lines[0], "Net price (before tax): €10.67");
    assert.equal(lines[1], "Price incl. 10% tax: €11.74");
    assert.equal(lines[2], "Menu price (rounded up to 0.5): €12.00");
    assert.equal(lines[3], "Gross profit per plate (net of tax): €7.71");
    assert.equal(lines[4], "Real food cost after rounding: 29.3%");
    assert.ok(out.includes("https://graziechef.com/tools"));
  });

  it("without a rounding step the menu price line is omitted and profit uses the incl-tax price", () => {
    const out = menuPriceCalculator({
      plate_cost: 5,
      target_food_cost_percent: 25,
      vat_percent: 20,
    });
    assert.ok(out.includes("Net price (before tax): €20.00"));
    assert.ok(out.includes("Price incl. 20% tax: €24.00"));
    assert.ok(!out.includes("Menu price (rounded up"));
    assert.ok(out.includes("Gross profit per plate (net of tax): €15.00"));
    assert.ok(out.includes("Real food cost after rounding: 25.0%"));
  });

  it("rounds the menu price up, never down, to the step", () => {
    const out = menuPriceCalculator({
      plate_cost: 3.21,
      target_food_cost_percent: 30,
      vat_percent: 10,
      rounding_step: 0.5,
    });
    // net 10.70, incl. tax 11.77, next 0.5 step above is 12.00
    assert.ok(out.includes("Menu price (rounded up to 0.5): €12.00"));
  });

  it("leaves an incl-tax price that already sits on the step unchanged", () => {
    const out = menuPriceCalculator({
      plate_cost: 3,
      target_food_cost_percent: 30,
      vat_percent: 20,
      rounding_step: 0.5,
    });
    // net 10.00, incl. tax 12.00, already on a 0.5 step
    assert.ok(out.includes("Menu price (rounded up to 0.5): €12.00"));
  });

  it("rejects a missing plate cost and an out-of-range target", () => {
    assert.throws(
      () => menuPriceCalculator({} as never),
      /plate_cost must be a number/,
    );
    assert.throws(
      () =>
        menuPriceCalculator({ plate_cost: 3, target_food_cost_percent: 100 }),
      /target_food_cost_percent must be less than 100/,
    );
  });

  it("formats a non-EUR currency", () => {
    const out = menuPriceCalculator({
      plate_cost: 3.2,
      target_food_cost_percent: 30,
      vat_percent: 10,
      rounding_step: 0.5,
      currency: "USD",
    });
    assert.ok(out.includes("Net price (before tax): $10.67"));
  });
});

describe("food_cost_calculator", () => {
  const ingredients = [
    { name: "flour", quantity: 0.5, unit: "kg", unit_cost: 1.2 },
    { name: "eggs", quantity: 2, unit: "pcs", unit_cost: 0.3 },
    { name: "cheese", quantity: 0.1, unit: "kg", unit_cost: 20 },
  ];

  it("sums quantity times unit cost into the plate cost", () => {
    const out = foodCostCalculator({ ingredients });
    // 0.60 + 0.60 + 2.00 = 3.20
    assert.ok(out.includes("Plate cost: €3.20"));
  });

  it("reports the price for a target food cost percentage", () => {
    const out = foodCostCalculator({
      ingredients,
      target_food_cost_percent: 30,
    });
    assert.ok(out.includes("Price for a 30% food cost: €10.67"));
  });

  it("reports the actual food cost percentage at the current price", () => {
    const out = foodCostCalculator({ ingredients, current_price: 12 });
    assert.ok(
      out.includes("Food cost at the current price of €12.00: 26.7%"),
    );
  });

  it("rejects an empty ingredient list and a missing unit cost", () => {
    assert.throws(
      () => foodCostCalculator({ ingredients: [] }),
      /ingredients must be a non-empty array/,
    );
    assert.throws(
      () =>
        foodCostCalculator({
          ingredients: [{ name: "flour", quantity: 1 }],
        } as never),
      /missing unit_cost/,
    );
  });
});

describe("recipe_scaler", () => {
  it("scales every quantity by the portion ratio", () => {
    const out = recipeScaler({
      ingredients: [
        { name: "flour", quantity: 500, unit: "g" },
        { name: "milk", quantity: 250, unit: "ml" },
      ],
      original_portions: 4,
      target_portions: 6,
    });
    assert.ok(out.includes("Recipe scaled from 4 to 6 portions:"));
    assert.ok(out.includes("- flour: 750 g"));
    assert.ok(out.includes("- milk: 375 ml"));
    assert.ok(!out.includes("Batch cost"));
  });

  it("adds batch cost and cost per portion when unit costs are given", () => {
    const out = recipeScaler({
      ingredients: [
        { name: "flour", quantity: 0.5, unit: "kg", unit_cost: 1.2 },
        { name: "eggs", quantity: 2, unit: "pcs", unit_cost: 0.3 },
      ],
      original_portions: 2,
      target_portions: 4,
    });
    // scaled: 1 kg flour (1.20) + 4 eggs (1.20) = 2.40; per portion 0.60
    assert.ok(out.includes("Batch cost: €2.40"));
    assert.ok(out.includes("Cost per portion: €0.60"));
  });

  it("scales down as well as up", () => {
    const out = recipeScaler({
      ingredients: [{ name: "rice", quantity: 400, unit: "g" }],
      original_portions: 8,
      target_portions: 2,
    });
    assert.ok(out.includes("- rice: 100 g"));
  });

  it("rejects non-positive portion counts", () => {
    assert.throws(
      () =>
        recipeScaler({
          ingredients: [{ name: "rice", quantity: 100 }],
          original_portions: 0,
          target_portions: 2,
        }),
      /original_portions must be greater than zero/,
    );
  });
});

describe("allergen_matrix", () => {
  it("normalises English, Italian and common names", () => {
    assert.equal(normaliseAllergen("shrimp"), "crustaceans");
    assert.equal(normaliseAllergen("dairy"), "milk");
    assert.equal(normaliseAllergen("Glutine"), "cereals containing gluten");
    assert.equal(normaliseAllergen("uova"), "eggs");
    assert.equal(normaliseAllergen("sesame"), "sesame seeds");
    assert.equal(normaliseAllergen("solfiti"), "sulphur dioxide/sulphites");
    assert.equal(normaliseAllergen("milk"), "milk");
  });

  it("builds the dish table and the per-allergen dishes to avoid", () => {
    const out = allergenMatrix({
      dishes: [
        { name: "Shrimp pasta", allergens: ["shrimp", "gluten", "eggs"] },
        { name: "Green salad", allergens: [] },
        { name: "Panna cotta", allergens: ["dairy"] },
      ],
    });
    assert.ok(
      out.includes("- Shrimp pasta: crustaceans, cereals containing gluten, eggs"),
    );
    assert.ok(out.includes("- Green salad: none declared"));
    assert.ok(out.includes("- crustaceans: Shrimp pasta"));
    assert.ok(out.includes("- milk: Panna cotta"));
    assert.ok(out.includes("- celery: none"));
  });

  it("covers all fourteen EU allergens in the avoid list", () => {
    const out = allergenMatrix({
      dishes: [{ name: "Soup", allergens: ["celery"] }],
    });
    const avoidSection = out.split("Dishes to avoid, by allergen:")[1];
    const rows = avoidSection
      .split("\n")
      .filter((line) => line.startsWith("- "));
    assert.equal(rows.length, 14);
  });

  it("does not guess allergens from dish names and rejects unknown names", () => {
    const out = allergenMatrix({
      dishes: [{ name: "Peanut surprise", allergens: [] }],
    });
    assert.ok(out.includes("- Peanut surprise: none declared"));
    assert.ok(out.includes("- peanuts: none"));
    assert.throws(
      () =>
        allergenMatrix({
          dishes: [{ name: "X", allergens: ["kiwi dust"] }],
        }),
      /unknown allergen/,
    );
  });

  it("rejects an empty dish list", () => {
    assert.throws(() => allergenMatrix({ dishes: [] }), /non-empty array/);
  });
});
