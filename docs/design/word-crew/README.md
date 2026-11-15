# Word crew character concepts

Status: exploring stick figures; awaiting character approval. This is a static design exploration, not a shipped feature. The plugin remains at version 0.4.0.

The owner rejected the first three character concepts, preferred the middle line-drawn helper, and requested a range of stick figures. These eight variations explore that direction. No individual design has been approved yet.

![Eight stick figures: Classic, Round hands, Long legs, Big head, Bent limbs, Green ink, Doodle, and Solid head. Each is shown standing, carrying a word, and alongside text on light and dark backgrounds.](stick-figure-variations.png)

The proposed app height is **28 CSS pixels**, approximately two stacked 14-pixel text lines. The enlarged views show the character design; the small text strips illustrate relative size, not a pixel-accurate screenshot of the plugin. Exact scale and silhouette will be checked in the animation prototype.

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

Options B and E are the suggested starting points for readable word handling. Features can be combined at the owner's request. All options use a line for the torso rather than clothing or a filled body. For dark surfaces, adapt dark outlines to a light color while retaining green accents.

Use the existing Lift green and flat colors for the eventual character assets. Keep the approved plugin icon and still Quiet Desk banner unchanged. The generated sheet is an art-direction reference; it is not a production sprite sheet. The earlier [three-character sheet](character-concepts.png) is retained only as the previous exploration.

## Approval order

1. The owner chooses or revises the character design.
2. Create an isolated animation prototype for approval: running, reaching, lifting, carrying, placing and exiting.
3. After animation approval, integrate the chosen animation into the composer and verify its workflow behavior.

The owner explicitly requested these two approval stages before implementation. No animation or production UI code is included in this change.

## Requested eventual behavior

- Clicking Enhance starts a little crew inside **Write a request**, approximately one character for every ten words.
- The characters choose words, lift them, carry them to other positions and put them down. Words may leave and new decorative words may arrive; the visual text can be scrambled.
- Lock request editing while the enhancement runs. Preserve the original request as data; moving decorative words must never change the model input, saved draft or actual generated result.
- Keep the existing progress bar visible. When actual enhancement reaches completion, the crew runs off-screen and a descending bar visually pushes the displayed text toward the result section.
- Failure and cancellation restore the editable original request. They must not play a successful-completion effect.

For the next prototype, settle exact sizing against the real composer font, short/long-request crew counts, clipping and word spacing, completion timing, theme contrast and reduced-motion behavior. The animation must remain separate from model progress and sending consent. No desktop or browser UI automation is authorized.
