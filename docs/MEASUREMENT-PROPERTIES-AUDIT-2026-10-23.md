# Measurements and the compact plan properties sheet

MiniMax's SpacePlanner port is present at cf7ea2f; the custom domain served
that exact stamp at the start of this audit. Its numeric room editing is useful,
but storing only percentages made a typed measurement change with calibration.

This patch stores optional user-stated metres per room axis. Calibration keeps
valid statements fixed and rescales the other sketch dimensions. An impossible
statement refuses the whole calibration. Save/import/share preserve the metadata;
legacy plans remain scaled. Geometry edits invalidate statements on the changed
axes at both command and completed-gesture boundaries. Undo restores the original
plan and its provenance. The editable input retains a plain numeric value; a
separate ~ marks dimensions inferred from scale, with a screen-reader description.
Focusing and leaving a rounded number does not change the geometry or provenance.

A known-room calibration explicitly replaces that reference axis with the new
measurement, after the rounded field scale is calculated. Other stated dimensions
remain fixed. This may expose overlaps or misplaced furniture: those existing
warnings remain active; calibration does not solve room adjacency constraints.

The screenshot supplied by Dr Non showed repeated calibration prose, large nested
cards and excessive section spacing. Plan properties now use a 48px header,
12px section spacing, paired fields and a disclosure for calibration from a known
length. The two calibration methods, upload, AI and room properties are retained.
Phone inputs keep 44px touch targets; desktop inputs are 36px. Workspace palettes
are unchanged. The same controls remain outside the drawing viewport.

Fresh adversarial review found and helped verify four boundary defects: stale
provenance after resizing, rounding on untouched blur, contradictory known-length
calibration, and the gesture path bypassing command normalization. All received
specific fixes. Validation and production evidence are recorded below at release.

Scope limits: this patch marks editable room axes. It does not establish measured
wall-face conventions or add provenance to every derived area/cost/export label.
