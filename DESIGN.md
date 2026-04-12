# Design System — my_tps (Treatment Planning System)

## Product Context
- **What this is:** Browser-based Treatment Planning System (TPS) for radiation oncology — a clinical tool for contouring, dose calculation, and treatment planning workflow
- **Who it's for:** Radiation oncologists, medical dosimetrists, medical physicists
- **Space/industry:** Medical imaging / radiation oncology
- **Project type:** Professional clinical web application (B/S architecture)

## Aesthetic Direction
- **Direction:** Clinical Precision — dark, focused, high-contrast medical UI. Professional and trustworthy. Built for all-day clinical use; every visual choice reduces fatigue while maintaining precision.
- **Decoration level:** Minimal — the medical imaging data IS the decoration. UI chrome stays out of the way.
- **Mood:** Focused, clinical, precise. Not "tech startup dark mode" — purpose-built for clinicians who stare at screens for 8+ hours.
- **Reference sites:** RT-VIEWER (test_module/RT-VIEWER-main), OHIF Viewer

## Typography
- **Display/Hero:** IBM Plex Sans — weight 700, clean and authoritative
- **Body/UI:** IBM Plex Sans — weight 400/500/600 depending on hierarchy
- **Data/Measurements:** IBM Plex Mono — tabular nums for alignment, clinical precision feel
- **Fallback:** -apple-system, BlinkMacSystemFont, sans-serif
- **Loading:** Google Fonts CDN (IBM Plex Sans + IBM Plex Mono)
- **Scale:** 48px (hero) · 24px (h2) · 18px (h3/panel titles) · 15px (body) · 13px (secondary) · 12px (labels/metadata) · 11px (micro-labels, uppercase tracking)

## Color
- **Approach:** Balanced — teal primary for clinical trust, amber for dose accents
- **Primary:** `#58c4dc` — Teal. High visibility on dark backgrounds without harshness.
- **Secondary:** `#7ee0a1` — Mint green. Used for OAR structures and success states.
- **Dose Amber:** `#f6c177` — Warm amber for dose heatmaps. Not the classic red scale — more modern, warmer.
- **Neutrals (blue undertone):**
  - Base/Background: `#07111f`
  - Surface/Paper: `#0d1828`
  - Elevated: `#122035`
  - Hover: `#1a2a42`
  - Borders: `rgba(156, 200, 216, 0.1)` / `rgba(156, 200, 216, 0.2)`
- **Semantic:** Success `#4fd1a5` · Warning `#f6c177` · Error `#e06c75` · Info `#58c4dc`
- **Dark mode:** Default is dark. Light mode future consideration: reduce saturation 10-20%, warm neutrals instead of blue-tinted.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable — tight enough for clinical data interfaces, breathable enough for long sessions
- **Scale:** 2xs(2) · xs(4) · sm(8) · md(16) · lg(24) · xl(32) · 2xl(48) · 3xl(64)

## Layout
- **Approach:** Hybrid — clinical grid discipline for patient lists and tool panels, flexible viewport workspace for imaging
- **Grid:** 3-column primary layout (sidebar | viewport | right panel). Viewport grid supports 1×1 through 4×4.
- **Max content width:** No hard max — clinical workstations vary. Viewport fills available space.
- **Border radius:** Hierarchical — sm:4px · md:8px · lg:12px · full:9999px (chips)

## Motion
- **Approach:** Minimal-functional — state transitions only. No entrance animations. No scroll-driven effects.
- **Rationale:** Clinical tools require instant responsiveness. Motion is limited to panel open/close, tool selection feedback, and loading states.
- **Easing:** ease-out (enter), ease-in (exit), ease-in-out (move)
- **Duration:** micro(50-100ms) · short(150-250ms) · medium(250-400ms)

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-05 | Initial design system created | Created by /design-consultation based on TPS for radiation oncology |
