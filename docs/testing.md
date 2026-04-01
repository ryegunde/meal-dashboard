# Testing

The **Meal Pipeline Planner** uses the [Playwright](https://playwright.dev/) framework for automated end-to-end (E2E) testing. This ensures that the application's core logic and UI components work as expected across different browsers and scenarios.

## Testing Strategy

The test suite is located in the `[tests/](file:///c:/src/Antigravity/meal-dashboard/tests/)` directory and consists of several focused specification files:

-   **`builders.spec.js`**: Verifies the functionality of the recipe and food stage builders.
-   **`calendar.spec.js`**: Tests calendar navigation and meal scheduling interactions.
-   **`engine.spec.js`**: Validates the core simulation engine's logic (Green/Blue/Red statuses).
-   **`scheduling.spec.js`**: Ensures that scheduled meals are correctly saved and rendered.

## Running Tests Locally

To execute the test suite on your machine:

1.  **Standard Run**:
    ```bash
    npm test
    ```
    This runs all tests in the background using the configured browsers.

2.  **UI Mode (Interactive)**:
    ```bash
    npm run test:ui
    ```
    This opens the Playwright UI, allowing you to see the tests executing in real-time and explore failures.

## CI/CD Integration

Tests are automatically executed on every push and pull request via GitHub Actions. If any test fails, a detailed report is generated and can be downloaded from the Action run's artifacts.

## Writing New Tests

When adding new features or fixing bugs, please follow these guidelines:
-   Use descriptive test names.
-   Mock data where necessary to ensure isolation.
-   Test both "happy paths" (e.g., successful meal scheduling) and "edge cases" (e.g., missing ingredients).
-   Target elements using semantic roles or test-specific IDs (`data-test-id`) to ensure tests are robust.
