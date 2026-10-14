import { useId } from 'react'
import { roomOverlaps, siteOf } from '../plan'
import { clockLabel, normalizedCivilHour } from '../location/solar'
import type { PlanState, ProjectLocation } from '../types'
import { GraphicScale } from './DrawingAnnotations'
import { groundShadows, planWallCuts, seasonalSun, studyWalls, type SeasonalSun } from './graphics'
import { SectionDrawing } from './StudySheet'

export function ShadowPlan({ plan, scale, sun, depth }: { plan: PlanState; scale: number; sun: SeasonalSun; depth: number }) {
  const id = useId(), site = siteOf(plan), k = 1000 / scale, width = site.w * k, height = site.h * k
  const point = (x: number, z: number) => `${(x + site.w / 2) * k},${(z + site.h / 2) * k}`
  return <svg className="study-shadow-plan" viewBox={`-4 -4 ${width + 8} ${height + 16}`} width={`${width + 8}mm`} height={`${height + 16}mm`} role="img" aria-label={`Wall ground shadows on ${sun.date} at 1:${scale}`}>
    <defs><clipPath id={id}><rect width={width} height={height} /></clipPath></defs>
    <rect width={width} height={height} fill="white" stroke="#68717a" strokeWidth=".18" />
    <g clipPath={`url(#${id})`}>
      <g fill="#c3c7ca" data-shadow-polygons="true">{groundShadows(studyWalls(plan), sun).map((p, i) => <polygon key={i} points={p.map(q => point(q.x, q.z)).join(' ')} />)}</g>
      <g fill="none" stroke="#68717a" strokeWidth=".18">{plan.rooms.map(r => <rect key={r.id} x={r.x / 100 * width} y={r.y / 100 * height} width={r.w / 100 * width} height={r.h / 100 * height} />)}</g>
      <g fill="#15202b">{planWallCuts(plan).map((p, i) => <rect key={i} x={(p.position[0] - p.size[0] / 2 + site.w / 2) * k} y={(p.position[2] - p.size[2] / 2 + site.h / 2) * k} width={p.size[0] * k} height={p.size[2] * k} />)}</g>
      <line x1="0" x2={width} y1={depth * k} y2={depth * k} stroke="#15202b" strokeWidth=".18" strokeDasharray="2 1" />
    </g>
    <GraphicScale k={k} x={0} y={height + 3} available={Math.max(8, width / 2)} />
    <text x={width} y={height + 7} textAnchor="end" fontSize="2.5" fill="#15202b">N ↑</text>
  </svg>
}

export function SeasonalSheet({ plan, title, location, hour, year, scale, depth }: {
  plan: PlanState; title: string; location: ProjectLocation; hour: number; year: number; scale: number; depth: number
}) {
  const suns = seasonalSun(location, year, hour)
  return <article className="study-paper study-seasonal-paper" aria-label="Seasonal solar study sheet">
    <header><img src="./brand/designon-wordmark.png" alt="designon" /><div><h1>{title} / Seasonal sun</h1><p>{location.label} · {year} · {clockLabel(hour)} local civil time · {location.timezone}</p></div><strong>S-01 · Rev 00<br />Concept study · 1:{scale}</strong></header>
    <div className="study-seasonal-grid">
      {suns.map(sun => {
        const civil = normalizedCivilHour(location, sun.day, hour, year)
        return <section key={sun.date}>
          <h2>{sun.date} / {clockLabel(civil)} · altitude {sun.altitude.toFixed(1)}° · bearing {sun.bearing.toFixed(1)}°</h2>
          {civil !== hour && <p>Civil time advanced through a daylight-saving gap.</p>}
          <ShadowPlan plan={plan} scale={scale} sun={sun} depth={depth} />
          <p>{sun.altitude <= 0 ? 'Sun below horizon: no direct sunlight.' : 'Grey: walls-only ground shadows, clipped to drawing field.'}</p>
          <h2>Section A–A / same cut and scale</h2>
          <SectionDrawing plan={plan} scale={scale} depth={depth} sunVector={sun.vector} />
          <p>Sun direction projected east-west; depth omitted. Indoor light not predicted.</p>
        </section>
      })}
      <p className="study-solar-method">Fixed June/December dates, not exact solstice instants; seasons depend on latitude. Shadows use full-height walls and opening gaps on base-level ground. Roofs, furniture, glazing transmission and neighbours excluded. Use the live 3D view for the full building.</p>
    </div>
    <footer>{roomOverlaps(plan.rooms).size > 0 && <strong>Rooms overlap; correct the drawing. </strong>}SunCalc at the selected city's coordinates and civil time; computed locally without image generation. 150 mm walls assumed; levels relative to finished floor. Print 100%; confirm before construction. Graphic conventions informed by AIA, Architectural Graphic Standards, Student Edition, 11th ed. (2008); original drawings.</footer>
  </article>
}
