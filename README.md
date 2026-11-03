# dishmath

Restaurant arithmetic that runs entirely on your own machine: what a
plate costs to make, what to charge for it, how a recipe changes
between portion counts, and which dishes a guest with an allergy must
avoid. There is no account, no key and no network call — every answer
is computed locally from the numbers you pass in.

## The four calculations

- **Food cost** — add up a dish ingredient by ingredient. Alongside
  the plate cost you can ask for the selling price that lands on a
  target food-cost percentage, and for the percentage you are really
  running at today's price.
- **Menu price** — start from a plate cost and a target food-cost
  percentage. You get the net price, the price with VAT added, that
  price rounded up to a clean step (0.50, 1.00, …), the gross profit
  per plate net of tax, and the food-cost percentage the rounded
  price actually gives you.
- **Recipe scaling** — give a recipe written for one number of
  portions and get every quantity rewritten for another. When the
  ingredients carry unit costs, the batch cost and the cost per
  portion come with it.
- **Allergen matrix** — declare the allergens in each dish and get
  the dish-by-allergen table used under EU Regulation 1169/2011
  (Annex II), plus the list of dishes to avoid for each of the 14
  allergens. Names are accepted in English or Italian, and common
  names work too: "shrimp" counts as crustaceans, "dairy" as milk.
  The tool never guesses allergens from a dish's name — a dish with
  none declared is reported that way.

Money is rounded half-up to two decimals and percentages to one
decimal. An optional ISO currency code (default `EUR`) changes only
how amounts are printed.

Worked example, plate cost €3.20 at a 30% target with 10% VAT and a
0.50 rounding step:

```
Net price (before tax): €10.67
Price incl. 10% tax: €11.74
Menu price (rounded up to 0.5): €12.00
Gross profit per plate (net of tax): €7.71
Real food cost after rounding: 29.3%
```

## CLI

```bash
npx @reneturcios/dishmath menu_price_calculator '{"plate_cost":3.20,"target_food_cost_percent":30,"vat_percent":10,"rounding_step":0.50}'
npx @reneturcios/dishmath food_cost_calculator '{"ingredients":[{"name":"flour","quantity":0.5,"unit":"kg","unit_cost":1.20}],"target_food_cost_percent":30}'
npx @reneturcios/dishmath recipe_scaler '{"ingredients":[{"name":"flour","quantity":500,"unit":"g"}],"original_portions":4,"target_portions":6}'
npx @reneturcios/dishmath allergen_matrix '{"dishes":[{"name":"Shrimp pasta","allergens":["shrimp","gluten"]}]}'
npx @reneturcios/dishmath --version
```

Each tool subcommand takes a single JSON argument string and prints
the result as plain text. Exit codes: 0 on success, 1 on a
calculation or validation error, 2 on a usage error.

## MCP

```bash
npx -y @reneturcios/dishmath mcp
```

MCP client configuration:

```json
{
  "mcpServers": {
    "dishmath": {
      "command": "npx",
      "args": ["-y", "@reneturcios/dishmath", "mcp"]
    }
  }
}
```

Tools exposed over MCP: `food_cost_calculator`,
`menu_price_calculator`, `recipe_scaler`, `allergen_matrix`.

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/dishmath
docker run --rm ghcr.io/cloudcorprecords/dishmath menu_price_calculator '{"plate_cost":3.20,"target_food_cost_percent":30,"vat_percent":10,"rounding_step":0.50}'
```

The container's default command is `mcp`, so the first form starts
the stdio MCP server; any other arguments reach the CLI.

## Development

```bash
npm install
npm run build
npm test
npm run dev
```

## License

MIT — see `LICENSE`.
