# Enhance Prompt banner concepts

Status: archived review prototypes, created against v0.1.5. Quiet Desk was selected for v0.1.6.

Decision recorded after review: the owner selected **B, Quiet Desk**, with “GitHub Copilot” replacing the logo/version row and a single theme toggle replacing the two buttons. The original sketches below are retained as the review record; the [approved design](../superpowers/specs/2026-11-14-quiet-desk-design.md) governs implementation in v0.1.6.

Open [the interactive prototypes](banner-concepts.html) in a browser to compare them. The same preview is supplied in the chat. Each theme control changes its entire sample panel; the controls above each panel simulate circumstances. Navigation and composer content are visual context only. Everything is local sample data, with no model calls or saved changes.

## A: Prompt Press

A small illustrated printing press turns loose text fragments into an organized page. The dark teal and pale mineral backgrounds use flat colors, muted brass details, the existing prompt/spark logo, and the panel's Segoe UI/system typography. The title remains clear on a solid surface; the illustration occupies the right side below the theme control.

| Circumstance | Still illustration |
| --- | --- |
| Empty draft | Empty composing tray and blank sheet |
| Draft becomes nonempty | Loose type fragments appear once |
| Enhancement starts | Sheet sits under the press roller |
| Enhancement succeeds | Finished page appears beside the press |
| Enhancement fails | Unfinished sheet and amber marker |
| Enhancement is cancelled | Open press and unfinished sheet |

Recommendation: choose this if the banner should reflect the plugin's job. It has a distinctive identity and changes only when meaningful work happens. It does not vary with the clock.

## B: Quiet Desk

A flat illustration of a writing desk, typewriter, lamp, plant, and window. Blue-gray surfaces and paper-colored details give it a calmer feel. This is an original interior scene, rather than the skyline used by Usage Insights.

| Circumstance | Still illustration |
| --- | --- |
| Morning, 05:00–11:59 local time | Low sun and warm hills outside the window |
| Afternoon, 12:00–17:59 | High sun and blue daylight |
| Night, 18:00–04:59 | Moon outside, lamp on |
| Draft / enhancement in progress | Page in the typewriter; a fixed working state during the run |
| Enhancement succeeds | Finished page rests next to the typewriter |
| Enhancement fails | Amber marker on the unfinished page |

Choose this if the subtle changes with time are the main appeal of Usage Insights. Time is sampled on opening or returning to the panel, so there is no continuously changing scenery. The clock changes the illustration only; it never overrides the user's light/dark choice.

## Shared proposed behavior

- The labeled Light / Dark control stays at the top right. It changes the entire Enhance Prompt panel, not Copilot's surrounding native tabs or app chrome. Start from the system preference, then remember an explicit choice using the plugin's existing durable preferences. Canvas addresses can change, so persistence must not rely only on that page's local storage.
- Preserve the existing brand logo, version/release-notes action, language selector, and labeled navigation. In the sketches, the language label is moved beside the navigation to give the theme control a consistent place. Final narrow layouts must wrap controls without overlap.
- No animation, crossfade, pulse, shimmer, automatic carousel, or per-keystroke redraw. State changes replace one static illustration with another. No gradients.
- Artwork is decorative. A visible text label states the real workflow status; full errors and recovery actions remain in their existing panel locations. A finished page means an enhancement returned a result, not that it is correct, approved, or sent.
- Derive artwork from the current canvas's draft and run. An older retained result must not show a finished state after the draft changes. A new draft or project/session switch resets the scene appropriately. Sending and permission rules remain unchanged.
- No new project reads, analytics, provider requests, prompt-content inspection, or private information in the artwork. A draft's presence and the existing run state suffice. Quiet Desk also reads the local clock.
- On a narrow canvas, the artwork moves under the title and remains shallow. Labels stay readable; artwork does not cover controls.
- Production UI text will use the existing English, Vietnamese, and Chinese translation system. These English review mockups are deliberately outside the production bundle.

## Evidence and boundaries

The reference project's `src/panel/art.mjs` changes its sky with local time and building patterns when date ranges change. Its theme button is independent of the sky. Enhance Prompt already exposes draft, run, result, and busy state in `src/panel/state.ts`; its current `web/src/transport.ts` follows the system theme without a user override. A real implementation will need to reconcile that listener with the saved choice.

The prototype is a standalone document, not a new plugin route or a patch to the installed canvas. Both original illustrations use embedded SVG with no external resources. Script syntax, all sample-state render functions, and both theme controls are checked without browser or desktop automation. Visual approval is pending with the owner.
