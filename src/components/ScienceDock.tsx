import { OUTSIDE_ASSUMPTION } from '../location/climate'
import { clockLabel } from '../location/solar'
import React from 'react'
import type { HeatFlowSnapshot } from '../analysis'
import { useI18n } from '../i18n'

function watts(value: number): string {
  const absolute = Math.abs(value)
  return absolute >= 1000 ? `${(absolute / 1000).toFixed(1)} kW` : `${Math.round(absolute)} W`
}

export const ScienceDock = React.memo(function ScienceDock({
  heat,
  directSunM2,
  floorAreaM2,
  hour,
  setHour,
  day,
  setDay,
  outsideC,
  setOutsideC,
}: {
  heat: HeatFlowSnapshot
  directSunM2: number
  floorAreaM2: number
  hour: number
  setHour: (hour: number) => void
  day: number
  setDay: (day: number) => void
  outsideC: number
  setOutsideC: (temperature: number) => void
}) {
  const { tr, lang } = useI18n()
  const [mobileExpanded, setMobileExpanded] = React.useState(false)
  const sunPercent = Math.round((directSunM2 / Math.max(1, floorAreaM2)) * 100)
  const dated = new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : lang === 'zh' ? 'zh-Hans' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(new Date().getFullYear(), 0, day)))
  const seasonName = day === 355 || day === 172 || day === 80 || day === 266 ? tr(day === 355 ? 'December solstice' : day === 172 ? 'June solstice' : 'Equinox') : dated

  return (
    <section className={`science-dock ${mobileExpanded ? 'is-mobile-expanded' : ''}`} aria-label={tr('Live sun and heat snapshot')}>
      <button
        className="science-mobile-toggle"
        type="button"
        aria-expanded={mobileExpanded}
        onClick={() => setMobileExpanded((expanded) => !expanded)}
      >
        {mobileExpanded ? tr('Done') : tr('Adjust')}
      </button>
      <div className="science-dock-summary">
        <div className="science-kicker">
          <span className="science-live" />
          {tr('Live envelope snapshot')}
          <small>{tr('clear-sky concept model')}</small>
        </div>
        <div className="science-metric">
          <span><small>{tr('Sunlit floor now')}</small><strong>{directSunM2.toFixed(1)} m² <em>{sunPercent}%</em></strong></span>
        </div>
        <div className="science-metric">
          <span><small>{tr('Through glass')}</small><strong>{heat.windowM2 > 0 ? <>{watts(heat.solarW)} <em>{tr('solar')}</em></> : <em>{tr('no windows yet')}</em>}</strong></span>
        </div>
        <div className="science-metric">
          <span><small>{tr('Walls + openings')}</small><strong>{watts(heat.wallW + heat.openingW)} <em>{heat.wallW + heat.openingW >= 0 ? tr('in') : tr('out')}</em></strong></span>
        </div>
        <div className={`science-net is-${heat.mode}`}>
          <span><small>{heat.windowM2 > 0 ? tr('Net right now') : tr('Net through walls')}</small><strong>{watts(heat.netW)} {heat.mode === 'balanced' ? tr('balanced') : heat.mode === 'heat-in' ? tr('entering') : tr('leaving')}</strong></span>
        </div>
      </div>

      <div className="science-controls">
        <label className="sun-scrubber">
          <span>{tr(clockLabel(hour))}</span>
          <input aria-label={tr('Sun time of day')} type="range" min="0" max="24" step="0.25" value={hour} onChange={(event) => setHour(Number(event.target.value))} />
          <small>{seasonName}</small>
        </label>
        <div className="science-seasons" aria-label={tr('Season presets')}>
          <button type="button" className={day === 355 ? 'active' : ''} onClick={() => setDay(355)}>{tr('Dec')}</button>
          <button type="button" className={day === 80 ? 'active' : ''} onClick={() => setDay(80)}>{tr('Mar')}</button>
          <button type="button" className={day === 172 ? 'active' : ''} onClick={() => setDay(172)}>{tr('Jun')}</button>
        </div>
        <label className="outside-temperature" title={tr(OUTSIDE_ASSUMPTION)}>
          {tr('Outside')}
          <input aria-label={tr('Outside air temperature')} title={tr(OUTSIDE_ASSUMPTION)} type="number" min="-30" max="55" value={outsideC} onChange={(event) => setOutsideC(Number(event.target.value))} />
          <span>°C</span>
          <small>{tr('assumed')}</small>
        </label>
        <details className="science-method">
          <summary aria-label={tr('How the heat snapshot is calculated')}>{tr('Method')}</summary>
          <div>
            <strong>{tr('What this number means')}</strong>
            <p><b>{tr('Transmission:')}</b> U × area × ΔT. <b>{tr('Sun')}</b> 800 W/m² × {tr('glass')} × SHGC × angle.</p>
            <p>{tr('Inside is held at 26°C. Current assumptions:')} {tr(`${heat.exteriorWallM2.toFixed(1)} m² opaque wall, ${heat.windowM2.toFixed(1)} m² glass, ${heat.doorM2.toFixed(1)} m² doors.`)}</p>
            <p className="science-caveat">{tr('Not included: roof, floor, air leaks, clouds, trees, overhangs, people or equipment. Use it to compare moves—not size an AC system.')}</p>
            <nav aria-label={tr('Method sources')}>
              <a href="https://www.energy.gov/cmei/femp/purchasing-energy-efficient-residential-windows-doors-and-skylights" target="_blank" rel="noreferrer">{tr('DOE · U-factor & SHGC')}</a>
              <a href="https://github.com/mourner/suncalc" target="_blank" rel="noreferrer">{tr('SunCalc · solar position')}</a>
              <a href="https://www.wbdg.org/resources/natural-ventilation" target="_blank" rel="noreferrer">{tr('WBDG · ventilation')}</a>
            </nav>
          </div>
        </details>
      </div>
    </section>
  )
})
