# RYAN COMMANDS

## Run The App Locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the local server:
   ```bash
   npm run dev
   ```
3. Open the app at:
   `http://localhost:8081`

## Run The Test Suite

1. Run all Playwright tests:
   ```bash
   npm test
   ```
2. Run tests in Playwright UI mode:
   ```bash
   npm run test:ui
   ```

## How Deployment Works

- The app is a static site deployed from the repository root on GitHub Pages.
- CI runs from [`.github/workflows/playwright.yml`](C:\src\Antigravity\meal-dashboard\.github\workflows\playwright.yml) on pushes and pull requests to `main`/`master`.
- The workflow installs dependencies, installs Playwright Chromium, runs `npx playwright test`, and uploads the Playwright report artifact.
- Typical release flow:
  1. Push changes to `main`.
  2. GitHub Actions runs the Playwright workflow.
  3. If checks pass, GitHub Pages serves the updated static files from the root branch source.
