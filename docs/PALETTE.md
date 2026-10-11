# Drawing studio palette

Source-verified Sanzo Wada combination 243 from
[Nonarkara/palette](https://colors.nonarkara.org/#plate-243).

| Historical colour | Credited digital conversion | Production role |
| --- | --- | --- |
| Ivory Buff | #ebd3a2 | restrained paper ground #eeefea; drawing sheet #fcfcf8 |
| Slate Color | #34454c | ink, deepened to #26383f |
| Olive Green | #6b7140 | companion #41482b retained for the 3D environment |
| Raw Sienna | #bb7125 | action and selection, deepened to #8a4c16 |

The screen values adapt the relationship for interface contrast. They do not
claim fidelity to the book's printed inks. The paper/ink ramp carries reading;
the decision index uses paper and ink; sienna marks actions and selection.
Analysis colours continue to report the model's actual states.

Historical colour names and combinations: Sanzo Wada. Digital conversions:
Matt DesLauriers' MIT-licensed dictionary-of-colour-combinations, based on
Dain M. Blodorn Kim's earlier compilation. Palette's independent exhibition,
selection and role interpretation: Dr Non. Applicable licence reproduced in
PALETTE-NOTICES.md.

Production checks require at least 4.5:1 for reading and action text and 3:1
for control boundaries, including the selected and support surfaces in every scheme.
Stage names, check marks, active borders, tool labels and opening line symbols
carry meaning independently of hue. Browser checks cover 375, 768 and 1280px,
real add-room/undo actions, calibration reachability and hint/zoom separation.

## Selectable Luma schemes

- [Solar Pop /209](https://colors.nonarkara.org/#plate-209): Ivory Buff,
  Yellow Orange and Salvia Blue; warm neutral paper, blue ink, sienna actions.
- [Guava Club /137](https://colors.nonarkara.org/#plate-137): Etruscan Red,
  Cinnamon Buff and Pistachio Green; a restrained rose ground with red actions.
- [Violet Hour /235](https://colors.nonarkara.org/#plate-235): Ivory Buff,
  Yellow Orange and Grayish Lavender B; a restrained lavender ground and ink.
- [Drafting Room /243](https://colors.nonarkara.org/#plate-243): original
  neutral paper, slate ink and sienna actions; the default for new users.

The October 11 request for a serious MoMA-informed workspace reduces the
coloured surface budget in all four schemes. Saved scheme IDs are preserved.
The drawing remains the dominant surface; palettes share identical geometry,
spacing and type, and no scheme changes the saved plan.

These names and production roles are our interpretation. Historical source
names and attribution remain as above. `src/design/themes.ts` supplies all
production colours; CSS aliases those roles instead of defining mood-specific
component overrides. First paint and 3D use the same selected scheme. The
user's choice is saved independently from the drawing.
