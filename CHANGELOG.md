# Changelog

## 0.1.0 (2026-10-27)

- Initial release: four MCP tools and matching CLI subcommands,
  all computed locally with no network access —
  `food_cost_calculator`, `menu_price_calculator`,
  `recipe_scaler` and `allergen_matrix`.
- Menu pricing follows the pinned derivation: tax is applied to
  the rounded net price, the menu price is rounded up to the
  chosen step, and profit and real food cost are computed back
  from the rounded price net of tax.
- The allergen matrix covers the 14 allergens of EU Regulation
  1169/2011 Annex II and accepts English, Italian and common
  allergen names.
