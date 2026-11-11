# Sidebar and Navigation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for native execution. Track the steps below and verify before completion.

**Goal:** Improve password-management documentation, configure sidebar modules independently, and add visible/hidden two-level navigation.

**Architecture:** Extend the existing shared settings schema and normalizer. AppComponent assigns visible module lists to SidebarComponent; HeaderComponent retains its sticky host and uses the existing Fuwari disclosure panels.

**Tech Stack:** Angular 21, TypeScript, Tailwind 4, browser APIs; no new dependencies.

**Spec:** docs/superpowers/specs/2026-11-11-navigation-sidebar-design.md

## Global Constraints

- Preserve existing sticky-header edits and all data files. No real Git writes, commits, pushes or cloud deployments.
- New settings use data/settings.json and the existing Git API save flow. Old sidebarReverse and flat menus remain compatible.
- Two navigation levels; mobile renders sidebar modules once in their original order.

## Review Focus

- Hidden parent/children must remain stored while disappearing from navigation.
- Only a TOC on the right must not create an empty homepage column; closing the only left announcement removes that column.
- Desktop navigation overflow must not clip submenus or overflow the viewport.
- Group-only parents survive settings save, and unsafe links/malformed settings fail clearly.
- Responsive rebuilding must preserve announcement dismissal and avoid duplicate IDs or stale open panels.

## Task 1: Password documentation

- [x] Update README.md with precise encryption, deployment-branch, history and private-repository guidance; retain links to docs/authentication.md and docs/admin.md.
- [x] Check official GitHub Pages, Netlify and Vercel plan restrictions; no prose-mirroring tests.

## Task 2: Sidebar positions

Files: src/shared/types.ts, src/shared/theme-settings.ts, src/app/app.component.ts, src/app/components/sidebar.component.ts, src/app/admin/settings.page.ts, src/styles.css; scripts/test-navigation-layout.ts and scripts/test-routing-state.ts.

- [x] RED: old settings default all modules left/right, invalid sides reject; actual AppComponent groups visible modules and drops an empty announcement/TOC column.
- [x] Add SidebarModule/SidebarSide and sidebarPositions; export module labels, sidebarModuleSide and availableSidebarModules(settings, content).
- [x] Pass module lists to SidebarComponent; use matchMedia and DestroyRef to render one mobile sidebar or desktop left/right groups. Keep hideSidebar and a 60px header offset.
- [x] Add per-module selectors and responsive two/three-column styles.
- [x] GREEN: run navigation-layout and routing-state tests.

## Task 3: Menu controls and submenus

Files: src/shared/types.ts, src/shared/theme-settings.ts, src/app/components/header.component.ts, src/app/admin/settings.page.ts; scripts/test-navigation-layout.ts.

- [x] RED: six built-in visibility switches; hidden parents/children filtered for display but preserved by normalizing/saving; group-only parents retained; invalid URLs/depth rejected; disclosure toggles and edge clamping.
- [x] Add MenuItem.visible, MenuLink.children and menuMoments/menuAbout defaults. Normalize two-level menu settings without mutating inputs.
- [x] Render desktop disclosure panels outside the scrollable menu row, mobile nested panels with distinct IDs, keyboard/outside/resize closure, and existing targets/base paths.
- [x] Add parent/child editors, visibility switches and labels in settings; preserve the existing AdminStore save flow.
- [x] GREEN: run navigation-layout tests and relevant existing theme/announcement tests.

## Final verification

- [x] Update README feature list and docs/admin.md, docs/config.md, docs/authentication.md for the final behavior.
- [x] Run the existing unit/service scripts and five real build checks, final pnpm run build, tsc and git diff --check; log output under tmp/navigation-layout.
- [x] Use an isolated local-demo origin for mobile/desktop interaction checks; preserve the user's browser data and restore temporary viewports.
- [x] Obtain one independent final review, fix material findings with a regression, verify original data hashes and record the result.

Final review: four Important findings fixed; three unit regressions and static-navigation build assertions RED→GREEN, 128/128 unit tests and 5/5 build scripts passing. Long-menu and Escape behavior verified in the browser. No declined items or deferred minors. A failed initial reviewer service did not produce a review; the available-model reviewer supplied the single completed independent review.

Ruling: static fallback links remain relative; subpath checks resolve them against the generated baseHref because that is the browser's actual destination. Evidence: tmp/navigation-layout/ and docs/acceptance-fixes.md. No commits or cloud deployment performed.
