# Copilot instructions for kaikaio-booking-native

This file helps future Copilot sessions understand repository structure, how to run tasks, and notable conventions specific to this project.

---

## 1) Build, test, and lint commands

Run from project root.

- Install dependencies: `npm install` (or `yarn install`).
- Start metro dev server: `npm start`.
- Run on Android (dev): `npm run android`.
- Run on iOS (dev, macOS): `npm run ios`.
- Build Android release APK: `npm run build:android` (runs Gradle in ./android).
- Run tests: `npm test` (Jest). To run a single test file: `npx jest path/to/test-file.test.tsx` or `npm test -- path/to/test-file.test.tsx`.
- Lint: `npm run lint` (ESLint).
- Other helpful scripts: `npm run reset-cache`, `npm run sync-version`, `npm run link-fonts`.

Notes:
- Node >= 18 is required (see package.json engines).
- Metro + Expo integration is used; `expo` is a dependency. Use `npx expo` if needed.

---

## 2) High-level architecture

- Type: React Native (Expo-compatible) mobile app written in TypeScript.
- Entry point: App.tsx — sets up navigation, safe area, gesture handler and CategoryContext provider. Navigation uses a native stack (React Navigation v7).
- Pages: `pages/` contains screen components (Login, Main, List, CategoryEdit, etc.). App routes: AuthLoading -> Login | Main, plus CategoryEdit.
- State:
  - Global business/state: `stores/` contains Zustand-based stores (e.g., `billStore.ts`). Zustand v5 is used to centralize cross-component state.
  - Per-feature context: `context/` contains CategoryContext for category icon lookup and classification.
  - Local UI state remains inside components (modals, visibility, refs).
- Services: `services/` holds API/IO logic used by stores and pages (request.ts likely centralizes network calls).
- Hooks: `hooks/` contains custom hooks used by pages/components.
- Components: `components/` contains reusable UI pieces (forms, pickers, icons).
- Types: `types/` defines shared TypeScript types (navigation param lists, domain types).
- Test setup: `jest.config.js` and `jest-setup.js` for Jest configuration and mocks.
- Build: Android uses native Gradle in `android/`. iOS uses Expo wrapper (`npx expo run:ios`) and CocoaPods for native deps.

---

## 3) Key conventions and patterns

- Module resolution: Babel `module-resolver` maps `@` to project root. Use `@/path/to/file` imports consistently.
- State organization: Prefer Zustand stores for shared/business state (see `REFACTORING_ZUSTAND.md` for rationale). Keep UI-only state local.
- Data transformation: Stores expose raw API data (`rawData`); components transform it with helpers (and CategoryContext's `getCategoryIcon`) using useMemo. Do not put UI render-specific transformations inside stores.
- Async storage and auth: Auth token is stored in AsyncStorage (key: `token`). App performs a token check in AuthLoading to route to Login or Main.
- Fonts/assets: `npm run link-fonts` runs a script to link fonts used by vector icons. If icons fail to appear, run it.
- Tests: Use Jest. Test files follow standard naming under `__tests__/` and component mocks are under `__mocks__`.
- Linting: ESLint config uses React Native preset (@react-native/eslint-config). Run `npm run lint` before PRs.
- Navigation types: Navigation stacks use a RootStackParamList in `types/navigation` — keep navigation props typed.
- Avoid persisting large API datasets in Zustand by default; persist only small cross-session preferences (the repo currently persists last selected date via AsyncStorage if needed).

---

## 4) Files to read for context (quick reference)
- App.tsx — entry, providers, navigation setup
- REFACTORING_ZUSTAND.md — rationale and examples for Zustand stores
- stores/billStore.ts — example store for billing flows
- context/CategoryContext.tsx — category icon and lookup provider
- pages/ListRefactored.tsx — preferred, refactored List using Zustand (List.tsx.backup holds original)
- request.ts — centralized network/request helper

---

## 5) Existing AI assistant or rules files
Look for and incorporate rules from these files if present; this repo doesn't include them currently:
- CLAUDE.md, .cursorrules, AGENTS.md, .windsurfrules, CONVENTIONS.md, AIDER_CONVENTIONS.md, .clinerules

---

If this file already exists, prefer appending missing details instead of overwriting.

---

Created: Copilot guidance for kaikaio-booking-native
