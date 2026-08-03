import { ChevronLeft, ChevronRight, Compass, Eye, X } from 'lucide-react'
import type { GuidedTourChapter } from '../tour/guidedTour'

export function GuidedTourOverlay({
  chapter,
  totalChapters,
  onPrev,
  onNext,
  onExit,
  onFocusRoom,
}: {
  chapter: GuidedTourChapter
  totalChapters: number
  onPrev: () => void
  onNext: () => void
  onExit: () => void
  onFocusRoom?: (roomId: string) => void
}) {
  return (
    <aside className="guided-tour-overlay" aria-label="Your drawing in 3D tour">
      <div className="guided-tour-card">
        <div className="guided-tour-header">
          <div className="guided-tour-badge">
            <Compass />
            <span>Your drawing in 3D</span>
          </div>
          <button
            type="button"
            className="guided-tour-close"
            onClick={onExit}
            aria-label="Exit Guided Tour"
          >
            <X />
          </button>
        </div>

        <div className="guided-tour-progress-bar">
          <div
            className="guided-tour-progress-fill"
            style={{ width: `${(chapter.number / totalChapters) * 100}%` }}
          />
        </div>

        <div className="guided-tour-body">
          <div className="guided-tour-chapter-label">{chapter.subtitle}</div>
          <h2 className="guided-tour-title">{chapter.title}</h2>
          <p className="guided-tour-description">{chapter.description}</p>

          {chapter.focusedRoomId && onFocusRoom && (
            <button
              type="button"
              className="guided-tour-focus-btn"
              onClick={() => onFocusRoom(chapter.focusedRoomId!)}
            >
              <Eye />
              <span>Inspect {chapter.focusLabel ?? 'this room'}</span>
            </button>
          )}

          <div className="guided-tour-metrics-grid">
            {chapter.metrics.map((metric) => (
              <div
                key={metric.label}
                className={`guided-tour-metric-tile ${metric.highlight ? 'highlight' : ''}`}
              >
                <span className="metric-label">{metric.label}</span>
                <strong className="metric-value">{metric.value}</strong>
              </div>
            ))}
          </div>

          {chapter.actionHint && (
            <div className="guided-tour-hint">
              <span>Next move</span><em>{chapter.actionHint}</em>
            </div>
          )}
        </div>

        <div className="guided-tour-footer">
          <span className="guided-tour-step">
            Chapter {chapter.number} of {totalChapters}
          </span>
          <div className="guided-tour-controls">
            <button
              type="button"
              className="guided-tour-btn secondary"
              onClick={onPrev}
              disabled={chapter.number === 1}
            >
              <ChevronLeft />
              <span>Previous</span>
            </button>
            <button
              type="button"
              className="guided-tour-btn primary"
              onClick={onNext}
            >
              <span>{chapter.number === totalChapters ? 'Finish Tour' : 'Next Chapter'}</span>
              <ChevronRight />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
