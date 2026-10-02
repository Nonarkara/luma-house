# Drawing studio palette

Source-verified Sanzo Wada combination 243 from
[Nonarkara/palette](https://colors.nonarkara.org/#plate-243).

| Historical colour | Credited digital conversion | Production role |
| --- | --- | --- |
| Ivory Buff | #ebd3a2 | paper, lightened to #f6f0e3 for the working sheet |
| Slate Color | #34454c | ink, deepened to #26383f |
| Olive Green | #6b7140 | decision index, deepened to #41482b with paper text |
| Raw Sienna | #bb7125 | action and selection, deepened to #8a4c16 |

The screen values adapt the relationship for interface contrast. They do not
claim fidelity to the book's printed inks. The paper/ink ramp carries reading;
olive stays within the decision index; sienna marks actions and selection.
Analysis colours continue to report the model's actual states.

Historical colour names and combinations: Sanzo Wada. Digital conversions:
Matt DesLauriers' MIT-licensed dictionary-of-colour-combinations, based on
Dain M. Blodorn Kim's earlier compilation. Palette's independent exhibition,
selection and role interpretation: Dr Non. Applicable licence reproduced in
PALETTE-NOTICES.md.

Measured production contrast: slate on paper 10.75:1; secondary text 6.41:1;
quiet text 5.17:1; paper on sienna action 6.23:1; paper on olive index 8.46:1.
Stage names, check marks, active borders, tool labels and opening line symbols
carry meaning independently of hue. Browser checks cover 375, 768 and 1280px,
real add-room/undo actions, calibration reachability and hint/zoom separation.

## Selectable Luma schemes

- [Solar Pop /209](https://colors.nonarkara.org/#plate-209): Ivory Buff,
  Yellow Orange and Salvia Blue; luminous yellow paper with a blue index.
- [Guava Club /137](https://colors.nonarkara.org/#plate-137): Etruscan Red,
  Cinnamon Buff and Pistachio Green; guava paper with a green index.
- [Violet Hour /235](https://colors.nonarkara.org/#plate-235): Ivory Buff,
  Yellow Orange and Grayish Lavender B; lavender paper with a violet index.
- [Drafting Room /243](https://colors.nonarkara.org/#plate-243): original
  paper/olive/sienna option.

These names and production roles are our interpretation. Historical source
names and attribution remain as above. `src/design/themes.ts` supplies all
production colours; CSS aliases those roles instead of defining mood-specific
component overrides. First paint and 3D use the same selected scheme. The
user's choice is saved independently from the drawing.
