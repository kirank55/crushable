# Plan

## Security (1-8)

1. Remove exposed API key from `.env.local`; rotate the key and add `.env.example` with placeholder values.
2. Fix iframe sandbox; remove `allow-same-origin` or isolate the iframe to a sandboxed origin to prevent XSS escape from AI-generated or user-edited HTML.
3. Replace `postMessage('*')` wildcard origin with a specific target origin for iframe communication.
4. Stop logging API key prefix; remove the `keyPrefix` logging in `openrouter.ts` and `storage.ts`.
5. Add rate limiting to the `/api/generate` route to prevent API key credit burn.
6. Add request payload size validation on the API route; `currentHtml` can be arbitrarily large.
7. Handle `response.json()` failure in error paths; wrap it in `try/catch` so non-JSON error responses do not mask the real error.
8. Add CSRF protection or at minimum validate the `Origin` header on the API route.

## Architecture (9-18)

9. Decompose `ChatPanel.tsx` (~2000 lines) into sub-components: `SetupWizard`, `MessageList`, `ChatInput`, `PlanEditor`, and `DiffView`.
10. Extract `useAIGeneration` hook; centralize all fetch and stream logic, which is currently duplicated four times in `ChatPanel`.
11. Extract `useIntentDetection` hook; move intent detection, smart block matching, and regex logic out of `ChatPanel`.
12. Move `ProjectDetails` interface from `ChatPanel.tsx` to `src/types/index.ts`.
13. Unify model label and metadata into a single source of truth; eliminate the duplicated `getModelLabel` function and scattered model constants.
14. Merge `FREE_AUTO_MODEL` and `FREE_MODEL` constants; they are identical.
15. Add a state management layer such as Zustand or React Context to replace the 17-prop drilling from `BuilderPage` into children.
16. Split `globals.css` (~2900 lines) into per-component CSS modules or co-located styles.
17. Cache `getAvailableModels()` result; `JSON.parse(process.env.NEXT_PUBLIC_MODELS)` runs on every call.
18. Re-evaluate the global edge runtime declaration; it constrains all routes without clear benefit.

## Error Handling (19-24)

19. Add a React Error Boundary at the app root and around major panels to prevent full-page white-screen crashes.
20. Handle `localStorage` quota exceeded; wrap `setItem` calls in `try/catch` with user-friendly messaging.
21. Guard `navigator.clipboard.writeText`; await the promise and handle permission or security errors.
22. Fix stale closure in auto-save; the `useEffect` omits `handleSave` from dependencies, risking stale block state being saved.
23. Add centralized API error handling; create a shared `fetchGenerate()` utility that handles non-OK, non-JSON, and network errors consistently.
24. Add timeout and retry logic for OpenRouter calls; a slow or hung response currently blocks indefinitely.

## Performance (25-32)

25. Incremental iframe updates; avoid tearing down and remounting the entire iframe on every block change, and use `contentDocument` manipulation instead.
26. Wrap child components in `React.memo()`; `ChatPanel`, `PreviewPanel`, `SectionPanel`, and `Toolbar` all re-render on any parent state change.
27. Virtualize the message list in `ChatPanel`; streaming updates currently trigger `O(n)` array mapping and full list re-renders.
28. Cache Tailwind CDN and Prism.js in the iframe; avoid re-fetching 300KB+ on every iframe remount.
29. Lazy-load `ChatPanel` and `VersionsPanel` via `React.lazy()` or `next/dynamic` since they are conditionally shown.
30. Deduplicate section-building loops; `executeSectionPlan` and `handleMultiSectionGeneration` share ~100 lines of identical code.
31. Optimize auto-save serialization; save only the changed project instead of serializing the entire projects array.
32. Add pagination or virtualization for the project list and version history.

## Testing (33-36)

33. Set up a test runner with Vitest or Jest and basic configuration.
34. Add unit tests for `lib` utilities; `blocks.ts`, `prompt.ts`, `import.ts`, `export.ts`, and `storage.ts` are pure logic and easy to test.
35. Add integration tests for the `/api/generate` route; mock OpenRouter to test mode routing, key resolution, and error cases.
36. Add E2E tests with Playwright for critical flows: project creation, section generation, section editing, and export.

## Accessibility (37-42)

37. Add focus traps to all modals; Settings, Help, and Versions panel currently allow Tab to escape behind the overlay.
38. Add `role="dialog"` and `aria-modal="true"` to all modal and overlay components.
39. Replace `<span role="button">` with native `<button>` elements in `SectionPanel` actions.
40. Add `aria-label` attributes to all icon-only buttons, the chat textarea, the code editor textarea, and section selectors.
41. Fix color contrast; `--text-muted: #737373` on `--bg-primary: #0d0d0d` fails WCAG AA at 4.0:1 versus the required 4.5:1.
42. Add keyboard support so Escape closes all modals, not just via backdrop click.

## UX Polish (43-47)

43. Replace native `confirm()` and `alert()` dialogs with styled, theme-consistent confirmation modals.
44. Add loading skeletons for the project list, builder panels, and version history instead of only showing a spinner.
45. Add a toast or notification system for save confirmations, export success, import warnings, and errors.
46. Add an onboarding or empty-state flow for first-time users with no projects.
47. Add multi-device project sync as an optional cloud persistence layer, even if initially only export-to-JSON backup.

## Code Quality (48-50)

48. Remove dead code, including `getDefaultBlocks()`, `getSettings()`, unused `addBlock`, `extractBlockIdFromHtml`, and unused icon imports.
49. Add Prettier with a consistent config and enforce single-quote style across the codebase.
50. Add a CI pipeline with GitHub Actions for lint, type-check, and test steps on every push or pull request.