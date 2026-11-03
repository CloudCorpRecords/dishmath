/**
 * dishmath types.
 *
 * Four pure-local tools: plate food cost, menu pricing,
 * recipe scaling and an allergen matrix. No network,
 * no key and no account are involved anywhere.
 */

export interface Ingredient {
  name: string;
  quantity: number;
  unit?: string;
  unit_cost?: number;
}

export interface FoodCostArgs {
  ingredients: Ingredient[];
  target_food_cost_percent?: number;
  current_price?: number;
  currency?: string;
}

export interface MenuPriceArgs {
  plate_cost: number;
  target_food_cost_percent: number;
  vat_percent?: number;
  rounding_step?: number;
  currency?: string;
}

export interface RecipeScalerArgs {
  ingredients: Ingredient[];
  original_portions: number;
  target_portions: number;
  currency?: string;
}

export interface DishAllergens {
  name: string;
  allergens: string[];
}

export interface AllergenMatrixArgs {
  dishes: DishAllergens[];
}
