# Deployment

The **Meal Pipeline Planner** is designed as a static site, making it easy to deploy to various hosting providers. The current deployment strategy uses **GitHub Pages**.

## Local Development

To run the application locally for development:
1.  Ensure you have [Node.js](https://nodejs.org/) installed.
2.  Install dependencies: `npm install`
3.  Start the development server: `npm run dev`
4.  Open `http://localhost:8080` in your browser.

## CI/CD Workflow

The project uses GitHub Actions for continuous integration and automated testing. The workflow is defined in:
`[.github/workflows/playwright.yml](file:///c:/src/Antigravity/meal-dashboard/.github/workflows/playwright.yml)`

This workflow runs on every push to the `main` branch and on pull requests. It performs the following steps:
-   Installs Node.js dependencies.
-   Installs Playwright browsers.
-   Runs the E2E test suite (`npm test`).
-   Uploads a Playwright report on failure.

## GitHub Pages Deployment

The application is hosted on GitHub Pages. To deploy or update the live site:
1.  Push changes to the `main` branch.
2.  GitHub Actions will automatically run the tests.
3.  Once tests pass, the site is served directly from the repository's root.

You can configure GitHub Pages settings under **Settings > Pages** in the GitHub repository.
-   **Source**: Deploy from a branch.
-   **Branch**: `main` (Root).

The live application is typically available at:
`https://[username].github.io/meal-dashboard/`
