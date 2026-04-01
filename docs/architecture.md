# Architecture & Design

The **Meal Pipeline Planner** is a client-side web application designed to help users manage meal preparation and ingredient inventory across multiple stages.

## Technology Stack

-   **Frontend**: Vanilla HTML5, CSS3, and JavaScript (ES6+).
-   **Icons**: [Phosphor Icons](https://phosphoricons.com/).
-   **Styling**: Custom CSS with CSS Variables for theming.
-   **Deployment**: GitHub Pages (Static Site).
-   **Persistence**: Browser `localStorage` (`PREPFLOW_DATA_V1`).

## Data Model

The application state is managed in a single `STATE` object in `main.js`, comprising:

-   **Foods**: Definitions of ingredients, including their name, category, and "prep stages" (e.g., Fridge -> Seasoned -> Cooked).
-   **Recipes**: Combinations of foods with specific quantities per portion.
-   **Inventory**: Tracking quantities of each food at various stages.
-   **Scheduled Meals**: A collection of meals assigned to specific dates and types (Breakfast, Lunch, Dinner).
-   **Computed Meals**: The result of the simulation engine, adding status (Green/Blue/Red) and missing ingredient details to scheduled meals.

## Automatic Midnight Cleanup

The application features an automatic "midnight cleanup" logic that runs on startup and every minute while the app is open:
-   It identifies "past meals" (scheduled dates before today) that haven't been processed.
-   It automatically subtracts the required ingredients from the **final stage** of the corresponding food's inventory.
-   Once processed, meals are marked as `consumed: true` to prevent double-deduction.

## Enhanced Meal Details & Interactivity

The meal details panel provides a comprehensive view of ingredients and allows for quick navigation:
-   **Ingredient Listing**: Lists *all* ingredients for a recipe, showing current inventory levels, required amounts, and statuses (Ready, Needs Prep, or Deficit).
-   **Portion-Based Management**: For specific foods (like meal-prepped proteins), users can define a `portionSize` (e.g., 150g). The Inventory view then allows entering quantities in "portions" (containers) which are automatically converted to grams for precise simulation tracking.
-   **Dynamic Header Navigation**: The week-based navigation (prev/next week and date range) is context-aware and automatically hides when the user switches to non-calendar views like Inventory or Foods.

## Core Logic: Simulation Engine

The `runSimulation()` function in `main.js` is the heart of the application. It evaluates each scheduled meal by:
1.  Identifying the required ingredients from the recipe.
2.  Checking the total available inventory for those ingredients.
3.  Determining the meal status:
    -   **Green**: All ingredients are available at the "Ready" stage.
    -   **Blue**: Ingredients are available in the pipeline but require preparation steps.
    -   **Red**: Insufficient quantities available in any stage.

## UI Structure & Rendering

The application uses a "Single Page Application" (SPA) approach with vanilla JS:
-   **Templates**: UI components are defined as `<template>` elements in `index.html`.
-   **View Management**: `renderView(viewName)` clears the main container and clones the appropriate template.
-   **Dynamic Updates**: Functions like `renderCalendar()`, `renderRecipes()`, etc., populate the templates with data from the `STATE`.
-   **Event Delegation**: Global event listeners handle interactions across different views and modals.
