/**
 * dishmath MCP server. Tools: food_cost_calculator,
 * menu_price_calculator, recipe_scaler, allergen_matrix.
 *
 * Why the low-level Server instead of McpServer: the
 * high-level helper converts zod schemas to JSON Schema
 * and injects keys that are not in this tool set's spec
 * ("$schema" and "additionalProperties"), which breaks
 * exact tool-list/schema parity. This file serves
 * tools/list with the spec's schemas as explicit
 * literals, and the core validates every tools/call
 * argument set itself. All computation is local.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import {
  allergenMatrix,
  foodCostCalculator,
  menuPriceCalculator,
  recipeScaler,
  VERSION,
} from "./kitchen.js";

const INGREDIENT_SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: "string" , description: "Name for this call." },
    quantity: { type: "number" , description: "Quantity value." },
    unit: { type: "string" , description: "The unit for this call." },
    unit_cost: { type: "number" , description: "The unit cost for this call." },
  },
  required: ["name", "quantity", "unit_cost"],
};

const SCALER_INGREDIENT_SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: "string" , description: "Name for this call." },
    quantity: { type: "number" , description: "Quantity value." },
    unit: { type: "string" , description: "The unit for this call." },
    unit_cost: { type: "number" , description: "The unit cost for this call." },
  },
  required: ["name", "quantity"],
};

const TOOLS = [
  {
    name: "food_cost_calculator",
    description:
      "Cost of a dish from its ingredients, the price that hits your target food cost %, and your actual food cost % at the current price.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ingredients: { type: "array", items: INGREDIENT_SCHEMA , description: "The ingredients for this call." },
        target_food_cost_percent: { type: "number" , description: "The target food cost percent for this call." },
        current_price: { type: "number" , description: "Current price value." },
        currency: { type: "string" , description: "Currency code, e.g. USD." },
      },
      required: ["ingredients"],
    },
  },
  {
    name: "menu_price_calculator",
    description:
      "From plate cost and target food cost: net price, price including VAT, menu price rounded up to a clean step, gross profit and real food cost after rounding.",
    inputSchema: {
      type: "object" as const,
      properties: {
        plate_cost: { type: "number" , description: "Cost per plate." },
        target_food_cost_percent: { type: "number" , description: "The target food cost percent for this call." },
        vat_percent: { type: "number" , description: "VAT percentage." },
        rounding_step: { type: "number" , description: "Rounding step size." },
        currency: { type: "string" , description: "Currency code, e.g. USD." },
      },
      required: ["plate_cost", "target_food_cost_percent"],
    },
  },
  {
    name: "recipe_scaler",
    description:
      "Scale a recipe from N to M portions. Returns every scaled quantity, plus batch cost and cost per portion when unit costs are given.",
    inputSchema: {
      type: "object" as const,
      properties: {
        ingredients: { type: "array", items: SCALER_INGREDIENT_SCHEMA , description: "The ingredients for this call." },
        original_portions: { type: "number" , description: "Original number of portions." },
        target_portions: { type: "number" , description: "Target number of portions." },
        currency: { type: "string" , description: "Currency code, e.g. USD." },
      },
      required: ["ingredients", "original_portions", "target_portions"],
    },
  },
  {
    name: "allergen_matrix",
    description:
      "The dish × allergen table required in the EU (Reg. 1169/2011, Annex II), with the dishes to avoid for each allergen. Accepts English, Italian or common names.",
    inputSchema: {
      type: "object" as const,
      properties: {
        dishes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" , description: "Name for this call." },
              allergens: { type: "array", items: { type: "string" } , description: "Allergens to consider (optional)." },
            },
            required: ["name", "allergens"],
          },
         description: "Dishes payload." },
      },
      required: ["dishes"],
    },
  },
];

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "dishmath", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;
  try {
    let out: string;
    switch (name) {
      case "food_cost_calculator":
        out = foodCostCalculator(a as never);
        break;
      case "menu_price_calculator":
        out = menuPriceCalculator(a as never);
        break;
      case "recipe_scaler":
        out = recipeScaler(a as never);
        break;
      case "allergen_matrix":
        out = allergenMatrix(a as never);
        break;
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(out);
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
