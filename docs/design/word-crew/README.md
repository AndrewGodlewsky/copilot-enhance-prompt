# Word crew character concepts

Status: **Classic stick figure approved; animation awaiting approval.** This is a design exploration, not a shipped feature. The plugin remains at version 0.4.0.

The owner selected **A — Classic** from the eight stick figures below, with one correction: the people must pick up the words themselves, with no surrounding box or tile.

## Animation preview

Open [animation-preview.html](animation-preview.html) locally and click **Enhance preview**. It is a standalone HTML file with no install, network requests, model calls or saved data. It is also presented inline in the design conversation. The preview does not modify the plugin.

- Hollow round heads, a simple line torso and bare line hands; no faces or clothing. Characters measure 28 pixels during carrying at actual size, alongside 14-pixel text.
- Reach, lift, walk, set down and release use continuous positions. While carrying, the hand endpoints and the bare word share coordinates, including the slight walking bob. The word has no visible container.
- Approximately one figure per ten words. A figure selects a word within its group of ten and carries it into a sufficiently wide word position. The replaced decorative word fades away. A single-word group uses a nearby empty position.
- The demo repeats those trips so the motion can be reviewed. Fresh word selection, more varied routes, arbitrary input layout and long-request density remain integration work after approval.
- The original request stays unchanged and read-only while the preview runs. Completion, cancellation and simulated failure restore it. Enter only edits the request.
- Simulated progress reaches 100% after 18 seconds of playback, or when **Finish now** is clicked. The figures run off-screen, then a descending bar pushes the decorative text toward the result area. No fabricated model result is shown.
- Pause, half speed, actual size / 2× detail, light / dark and reduced-motion controls support review. Reduced motion defaults to the system preference and skips the crew and sweep. A width change stops the demo and restores the original request.

Run `node docs/design/word-crew/animation.check.mjs` for the standalone checks: JavaScript syntax, crew count, Unicode preservation, 28-pixel carrying geometry, hand contact, continuous positions, SVG visibility and the control lifecycle. The DOM stand-in distinguishes HTML's reflected `hidden` property from SVG's attribute: the initial preview incorrectly assigned `scene.hidden = false`, leaving the SVG hidden while the textarea disappeared. The preview now removes the SVG attribute explicitly, renders its first frame before hiding the request and restores the request if startup or a later frame fails. Regression checks cover that visibility failure, figure movement and error recovery. These checks use Node, not a browser. Static motion poses were also rendered for geometry inspection without browser automation. Smoothness, exact font rendering, responsive appearance and visual approval still require the owner's manual review.

## Character exploration

![Eight stick figures: Classic, Round hands, Long legs, Big head, Bent limbs, Green ink, Doodle, and Solid head. Each is shown standing, carrying a word, and alongside text on light and dark backgrounds.](stick-figure-variations.png)

The proposed app height is **28 CSS pixels**, approximately two stacked 14-pixel text lines. The enlarged views show the character design; the small text strips illustrate relative size, not a pixel-accurate screenshot of the plugin. Use the animation preview's actual-size and 2× views to review the chosen silhouette.

| Option | Character | Distinguishing feature |
| --- | --- | --- |
| A | Classic | Hollow round head and plain strokes for body, hands and feet. |
| B | Round hands | Dot eyes, small green round hands and short feet make contact with a carried word visible. |
| C | Long legs | Smaller head and longer legs give a light, lanky silhouette. |
| D | Big head | Large expressive head with a short body and limbs. |
| E | Bent limbs | Articulated elbows and knees suggest lifting and carrying; green palms mark the grip. |
| F | Green ink | Simple figure drawn entirely in green. |
| G | Doodle | Curved, slightly irregular lines and a small smile. |
| H | Solid head | Filled head and bold limbs provide a strong minimal silhouette. |

Option A is the approved direction. The boxes in the original concept sheet are superseded by bare words in the animation preview. For dark surfaces, adapt dark outlines to a light color.

Use the existing Lift green and flat colors for the eventual character assets. Keep the approved plugin icon and still Quiet Desk banner unchanged. The generated sheet is an art-direction reference; it is not a production sprite sheet. The earlier [three-character sheet](character-concepts.png) is retained only as the previous exploration.

## Approval order

1. Character selection complete: A — Classic, carrying bare words.
2. Review the isolated animation prototype: running, reaching, lifting, carrying, placing and exiting.
3. After animation approval, integrate the chosen animation into the composer and verify its workflow behavior.

The owner explicitly requested these two approval stages before implementation. Animation code is confined to the standalone design preview; no production UI code is changed.

## Requested eventual behavior

- Clicking Enhance starts a little crew inside **Write a request**, approximately one character for every ten words.
- The characters choose words, lift them, carry them to other positions and put them down. Words may leave and new decorative words may arrive; the visual text can be scrambled.
- Lock request editing while the enhancement runs. Preserve the original request as data; moving decorative words must never change the model input, saved draft or actual generated result.
- Keep the existing progress bar visible. When actual enhancement reaches completion, the crew runs off-screen and a descending bar visually pushes the displayed text toward the result section.
- Failure and cancellation restore the editable original request. They must not play a successful-completion effect.

Before integration, review exact sizing against the real composer font, short/long-request crew counts, clipping and word spacing, completion timing, theme contrast and reduced-motion behavior. The animation must remain separate from real model progress and sending consent. No desktop or browser UI automation is authorized.
