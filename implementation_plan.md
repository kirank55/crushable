# Crushable Feature Improvements — Implementation Plan

This plan covers 12 feature tasks grouped into 5 logical components. Each component lists the files to modify, what changes to make, and how to verify.

---

## Proposed Changes

### Component 1: Chat Panel Positioning & UI Improvements

#### Task 1.1 — Message icon placement when chat is hidden
When the chat panel is hidden, the floating "Show Chat" button (`chat-show-btn`) currently sits at a fixed position. It should instead be placed in the **same position** as the "Hide Chat" button in the toolbar.

#### [MODIFY] [page.tsx](file:///c:/Users/kiran/code/p/crushable/src/app/project/%5Bid%5D/page.tsx)
- Move the `chat-show-btn` from the builder-main area into the toolbar-left area (same spot as the hide-chat button).
- Pass `chatVisible` and `onShowChat` to [Toolbar](file:///c:/Users/kiran/code/p/crushable/src/components/Toolbar.tsx#89-407) so it can render the MessageSquare icon in place of the PanelLeftClose icon when chat is collapsed.

#### [MODIFY] [Toolbar.tsx](file:///c:/Users/kiran/code/p/crushable/src/components/Toolbar.tsx)
- When `chatVisible === false`, render a `MessageSquare` icon button in the same position where the `PanelLeftClose` hide-chat button normally appears.
- Clicking it calls `onShowChat` (new prop, replaces current `onHideChat` toggle logic).

#### [MODIFY] [globals.css](file:///c:/Users/kiran/code/p/crushable/src/app/globals.css)
- Remove the standalone `chat-show-btn` floating styles since the button now lives in the toolbar.

---

#### Task 1.2 — Improve Chat UI & option to hide prompt chips
The prompt suggestion chips (e.g., "Add social proof", "Plan the whole page") are useful but can feel cluttered.

#### [MODIFY] [ChatPanel.tsx](file:///c:/Users/kiran/code/p/crushable/src/components/ChatPanel.tsx)
- Add a local state `showSuggestions` (default `true`) and a small toggle button (e.g., lightbulb icon) near the prompt chips that lets the user collapse/expand them.
- When collapsed, hide the `chat-suggestions` div.
- Apply minor UI polish: tighter spacing, smoother transitions, and better visual hierarchy for messages.

---

### Component 2: Preview Panel Enhancements

#### Task 2.1 — Preview in new tab
Add a button to open the current preview as a standalone page in a new browser tab.

#### [MODIFY] [Toolbar.tsx](file:///c:/Users/kiran/code/p/crushable/src/components/Toolbar.tsx)
- Add an `ExternalLink` icon button in the toolbar-right section.
- It calls a new `onOpenInNewTab` callback.

#### [MODIFY] [page.tsx](file:///c:/Users/kiran/code/p/crushable/src/app/project/%5Bid%5D/page.tsx)
- Implement `handleOpenInNewTab`: generate the full HTML using [generateFullHTML(blocks)](file:///c:/Users/kiran/code/p/crushable/src/lib/export.ts#3-30), create a Blob URL, and open it via `window.open()`.

---

#### Task 2.2 — URL bar on top of iframe + refresh + responsive toggle
Replace the current preview header (`preview-stage-header`) with a browser-style URL bar that includes:
- A favicon placeholder + simulated URL (e.g., `yourproject.crushable.dev`)
- A refresh button that forces iframe re-render (bump `previewDocKey`)
- The responsive toggle (mobile/desktop) moved from the toolbar to sit next to the URL bar

#### [MODIFY] [PreviewPanel.tsx](file:///c:/Users/kiran/code/p/crushable/src/components/PreviewPanel.tsx)
- Replace `preview-stage-header` with a new `preview-url-bar` component containing: Globe icon, project URL text, Refresh button, and responsive toggle buttons (Monitor/Smartphone icons).
- Accept new props: `onRefresh`, `onToggleMobilePreview`, `mobilePreview`, `projectName`.

#### [MODIFY] [Toolbar.tsx](file:///c:/Users/kiran/code/p/crushable/src/components/Toolbar.tsx)
- Remove the mobile preview toggle button from the toolbar (it will live in the URL bar now).

#### [MODIFY] [page.tsx](file:///c:/Users/kiran/code/p/crushable/src/app/project/%5Bid%5D/page.tsx)
- Add a `refreshKey` state value and pass `onRefresh` / `projectName` to [PreviewPanel](file:///c:/Users/kiran/code/p/crushable/src/components/PreviewPanel.tsx#32-623).
- Remove `onToggleMobilePreview` from Toolbar, pass it to PreviewPanel instead.

#### [MODIFY] [globals.css](file:///c:/Users/kiran/code/p/crushable/src/app/globals.css)
- Add `.preview-url-bar` styles (border, rounded, flex layout, input-like appearance).

---

#### Task 2.3 — Edit mode with Ctrl+Click (element-level editing inside iframe)
Add a "design mode" inspired by Lovable where `Ctrl+Click` selects an individual element inside the iframe (not just a section) and opens an inline editor.

#### [MODIFY] [PreviewPanel.tsx](file:///c:/Users/kiran/code/p/crushable/src/components/PreviewPanel.tsx)
- Add an `editMode` toggle (activated via a toolbar button or keyboard shortcut).
- In the preview interaction script injected into the iframe:
  - On `Ctrl+Click`, select the specific DOM element (not the parent `[data-block-id]` section), highlight it with a blue outline, and post a message to the parent with the element's outerHTML and CSS path.
- The parent receives the message and shows a small floating editor panel (below the URL bar or as a popover) that lets the user type a natural-language edit instruction for that element.
- On submit, the instruction is sent as an edit prompt to the API with the selected element's context, and the response replaces only that element's HTML within the block.
- Add new callback prop: `onElementEdit?: (blockId: string, elementSelector: string, instruction: string) => void`.

#### [MODIFY] [page.tsx](file:///c:/Users/kiran/code/p/crushable/src/app/project/%5Bid%5D/page.tsx)
- Implement the `handleElementEdit` callback that sends an element-scoped edit to the API route.

> [!IMPORTANT]
> This is the most complex feature. We should implement a basic version first (Ctrl+Click highlights and shows a prompt input), then iteratively improve the element targeting precision.

---

### Component 3: Toolbar & Section Panel Simplification

#### Task 3.1 — Toolbar buttons: icons only, text on hover
All toolbar buttons should show only their icon by default. The text label appears on hover via CSS tooltip or expanding button.

#### [MODIFY] [Toolbar.tsx](file:///c:/Users/kiran/code/p/crushable/src/components/Toolbar.tsx)
- Add `title` attributes to all buttons (many already have them).
- Wrap text labels in `.btn-label` spans (most already do).

#### [MODIFY] [globals.css](file:///c:/Users/kiran/code/p/crushable/src/app/globals.css)
- Hide `.btn-label` by default.
- On `.toolbar-btn:hover .btn-label`, show the label with a smooth slide-in transition.
- Adjust toolbar button widths/padding for icon-only mode.

---

#### Task 3.2 — Remove the Sections tab (SectionPanel)
The standalone Sections tab/panel is being removed to simplify the layout. Section management (reorder, duplicate, delete, visibility toggle) will be handled via the section list inside the chat panel or through the preview overlay interactions.

#### [MODIFY] [page.tsx](file:///c:/Users/kiran/code/p/crushable/src/app/project/%5Bid%5D/page.tsx)
- Remove the [SectionPanel](file:///c:/Users/kiran/code/p/crushable/src/components/SectionPanel.tsx#59-239) import and rendering.
- Remove `sectionsVisible` state and `onToggleSectionsPanel` prop from Toolbar.

#### [MODIFY] [Toolbar.tsx](file:///c:/Users/kiran/code/p/crushable/src/components/Toolbar.tsx)
- Remove the Layers toggle button for sections panel.
- Remove `onToggleSectionsPanel` and `sectionsVisible` props.

> [!NOTE]
> The [SectionPanel.tsx](file:///c:/Users/kiran/code/p/crushable/src/components/SectionPanel.tsx) file will be kept but no longer rendered. Section management actions (delete, duplicate, reorder, visibility) should eventually be accessible via preview overlay context menus or the chat panel's block selector dropdown. For now, the block selector dropdown in the chat input area already exists.

---

### Component 4: Background Color & Smooth Scroll Enforcement

#### Task 4.1 — Always add background to sections
Sections without explicit backgrounds can cause inconsistent colors (e.g., a dark-themed section followed by one that inherits white from the body).

#### [MODIFY] [prompt.ts](file:///c:/Users/kiran/code/p/crushable/src/lib/prompt.ts)
- Add a rule to the system prompt:
  ```
  SECTION BACKGROUNDS:
  - Every <section> MUST include an explicit background color or gradient via Tailwind classes (e.g., bg-white, bg-gray-900, bg-gradient-to-br).
  - NEVER leave a section without a background — this causes visual inconsistency when sections appear on different page backgrounds.
  ```

#### Task 4.2 — Smooth scroll in final HTML
The exported HTML currently lacks `scroll-behavior: smooth` on the `<html>` element.

#### [MODIFY] [export.ts](file:///c:/Users/kiran/code/p/crushable/src/lib/export.ts)
- Add `html { scroll-behavior: smooth; }` to the `<style>` block in [generateFullHTML](file:///c:/Users/kiran/code/p/crushable/src/lib/export.ts#3-30).

---

### Component 5: Post-Generation Bug Check (HTML Validation)

#### Task 5.1 — Validate generated HTML after full-page generation
After all sections are built, run a validation pass to catch common issues: broken nav links, duplicate navbars, missing images, and structural problems.

#### [NEW] [validate.ts](file:///c:/Users/kiran/code/p/crushable/src/lib/validate.ts)
Create a new utility that receives the assembled HTML and checks for:
- **Duplicate navbars**: more than one `<nav>` or `position: fixed/sticky` header.
- **Broken anchor links**: `<a href="#section-id">` where `#section-id` doesn't match any element's [id](file:///c:/Users/kiran/code/p/crushable/src/components/ChatPanel.tsx#487-495).
- **Missing images**: `<img>` tags with empty or placeholder `src`.
- **Missing backgrounds**: `<section>` tags without any `bg-` Tailwind class.
- **Smooth scroll**: verify `scroll-behavior: smooth` is present.
- Returns an array of `{ type: 'error' | 'warning', message: string }`.

#### [MODIFY] [ChatPanel.tsx](file:///c:/Users/kiran/code/p/crushable/src/components/ChatPanel.tsx)
- After `executeSectionPlan` and `handleMultiSectionGeneration` complete, call `validateGeneratedHtml()` on the assembled blocks.
- If issues are found, display a summary message in chat (e.g., "⚠️ Found 2 issues: broken nav link to #features, duplicate navbar detected").
- Optionally: send the final assembled HTML to the LLM for a "double-check" pass to fix issues (using a new `mode: "validate"` on the API route). This will be gated behind a flag initially since it adds an extra API call.

#### [MODIFY] [route.ts](file:///c:/Users/kiran/code/p/crushable/src/app/api/generate/route.ts)
- Add a `validate` mode that receives the full assembled HTML and asks the LLM to identify and fix common issues (broken links, duplicate navbars, missing backgrounds).
- The prompt instructs the LLM to return fixes in a structured format.

---

#### Task 5.2 — Design style auto-selection from description
Instead of the user manually picking a design style, send the product description to the LLM to select the best-fitting style from the available options.

#### [MODIFY] [ChatPanel.tsx](file:///c:/Users/kiran/code/p/crushable/src/components/ChatPanel.tsx)
- In the setup form (phase `"details"`), change the design style from a separate step to a `<select>` dropdown in the form (optional — the LLM will pick one by default).
- When the user submits the form, if no explicit style was selected, send a quick LLM call with the product description to pick the best style.
- Move the design style selection into the details form as a simple `<select>` element with the 5 available styles.

#### [MODIFY] [route.ts](file:///c:/Users/kiran/code/p/crushable/src/app/api/generate/route.ts)
- Add a `style-select` mode that receives the product description and returns one of the 5 style IDs.

---

## Verification Plan

### Browser Testing (via browser tool)
1. **Chat show/hide button position**: Hide chat → verify MessageSquare icon appears in the exact toolbar position where PanelLeftClose was → click to show chat → verify PanelLeftClose reappears.
2. **Preview in new tab**: Click "Open in new tab" → verify a new tab opens with the full HTML page.
3. **URL bar + refresh**: Verify the URL bar renders above the iframe with project name, refresh button works, and responsive toggle switches between mobile/desktop widths.
4. **Toolbar icon-only**: Verify toolbar buttons only show icons by default and labels appear on hover.
5. **Section panel removed**: Verify the section panel no longer renders in the builder layout.
6. **Prompt chips toggle**: Verify the suggestion chips can be hidden/shown via toggle button.
7. **Smooth scroll in export**: Export a page and verify the HTML contains `scroll-behavior: smooth`.
8. **Background enforcement**: Generate a new section, inspect the HTML confirming it includes a `bg-` class.

### Manual Verification
- **Ctrl+Click edit mode**: Open the builder, generate a few sections, Ctrl+Click on a specific element (like a button or heading) inside the preview, verify the element gets highlighted and the edit prompt input appears. Submit an edit and verify only that element changes.
- **Post-generation validation**: Generate a full landing page, then check that the chat shows any validation warnings (e.g., "no issues found" or specific warnings).
- **Design style auto-select**: Fill in the product description without manually picking a style, proceed to build, and verify the LLM picks an appropriate style.
