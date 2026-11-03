#!/usr/bin/env node
/**
 * dishmath CLI.
 *
 *   dishmath food_cost_calculator '<json>'
 *   dishmath menu_price_calculator '<json>'
 *   dishmath recipe_scaler '<json>'
 *   dishmath allergen_matrix '<json>'
 *   dishmath mcp
 *   dishmath --version
 *
 * Each tool subcommand takes one JSON argument string with
 * the tool's arguments and prints the tool's result text.
 * Exit codes: 0 success, 1 runtime error, 2 usage error.
 */
import {
  allergenMatrix,
  foodCostCalculator,
  menuPriceCalculator,
  recipeScaler,
  VERSION,
} from "./kitchen.js";

const TOOL_NAMES = [
  "food_cost_calculator",
  "menu_price_calculator",
  "recipe_scaler",
  "allergen_matrix",
] as const;

function usageError(): never {
  console.error(`Usage:
  dishmath <tool> '<json-args>'     one of: ${TOOL_NAMES.join(", ")}
  dishmath mcp
  dishmath --version`);
  process.exit(2);
}

async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "food_cost_calculator":
      return foodCostCalculator(args as never);
    case "menu_price_calculator":
      return menuPriceCalculator(args as never);
    case "recipe_scaler":
      return recipeScaler(args as never);
    case "allergen_matrix":
      return allergenMatrix(args as never);
    default:
      usageError();
  }
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    if (rest.length !== 0) usageError();
    await import("./mcp.js");
    return;
  }
  if (!(TOOL_NAMES as readonly string[]).includes(cmd ?? "")) usageError();
  if (rest.length > 1) usageError();
  let args: Record<string, unknown> = {};
  if (rest.length === 1) {
    try {
      const parsed: unknown = JSON.parse(rest[0]);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) usageError();
      args = parsed as Record<string, unknown>;
    } catch {
      console.error("error: argument must be a JSON object string");
      process.exit(2);
    }
  }
  try {
    const out = await runTool(cmd, args);
    console.log(out);
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
