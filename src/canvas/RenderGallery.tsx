import { DRAWING_STYLES, type DrawingStyleId } from '../drawing/styles'
import type { PlanState } from '../types'
import { DrawingSheet } from './DrawingSheet'

export function RenderGallery({
  plan,
  drawingStyle,
  onDrawingStyle,
}: {
  plan: PlanState
  drawingStyle: DrawingStyleId
  onDrawingStyle: (style: DrawingStyleId) => void
}) {
  return (
    <div className="render-gallery drawing-gallery" aria-label="Measured drawing sheet">
      <div className="drawing-style-bar" role="radiogroup" aria-label="Drawing style">
        {DRAWING_STYLES.map((style) => {
          const selected = style.id === drawingStyle
          return (
            <button
              key={style.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={selected ? 'active' : ''}
              onClick={() => onDrawingStyle(style.id)}
            >
              <i style={{ background: style.swatch }} />
              <span>{style.name}</span>
            </button>
          )
        })}
      </div>
      <div className="drawing-sheet-wrap">
        <DrawingSheet plan={plan} styleId={drawingStyle} />
      </div>
    </div>
  )
}
