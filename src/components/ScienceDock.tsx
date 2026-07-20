import React from 'react'
import { ArrowDownRight, ArrowUpRight, CircleHelp, CloudSun, Snowflake, Sun, Thermometer } from 'lucide-react'
import type { HeatFlowSnapshot } from '../analysis'

function watts(value: number): string {
  const absolute = Math.abs(value)
  return absolute >= 1000 ? `${(absolute / 1000).toFixed(1)} kW` : `${Math.round(absolute)} W`
}

function seasonName(day: number): string {
  if (day === 355) return 'Winter solstice'
  if (day === 172) return 'Summer solstice'
  if (day === 80 || day === 266) return 'Equinox'
  return `Day ${day}`
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
  const entering = heat.mode !== 'heat-out'
  const HeatIcon = entering ? ArrowDownRight : ArrowUpRight
  const sunPercent = Math.round((directSunM2 / Math.max(1, floorAreaM2)) * 100)

  return (
    <section className="science-dock" aria-label="Live sun and heat snapshot">
      <div className="science-dock-summary">
        <div className="science-kicker">
          <span className="science-live" />
          Live envelope snapshot
          <small>clear-sky concept model</small>
        </div>
        <div className="science-metric">
          <Sun />
          <span><small>Sunlit floor now</small><strong>{directSunM2.toFixed(1)} m² <em>{sunPercent}%</em></strong></span>
        </div>
        <div className="science-metric">
          <CloudSun />
          <span><small>Through glass</small><strong>{watts(heat.solarW)} <em>solar</em></strong></span>
        </div>
        <div className="science-metric">
          {entering ? <Thermometer /> : <Snowflake />}
          <span><small>Walls + openings</small><strong>{watts(heat.wallW + heat.openingW)} <em>{heat.wallW + heat.openingW >= 0 ? 'in' : 'out'}</em></strong></span>
        </div>
        <div className={`science-net is-${heat.mode}`}>
          <HeatIcon />
          <span><small>Net right now</small><strong>{watts(heat.netW)} {heat.mode === 'balanced' ? 'balanced' : heat.mode === 'heat-in' ? 'entering' : 'leaving'}</strong></span>
        </div>
      </div>

      <div className="science-controls">
        <label className="sun-scrubber">
          <span><Sun /> {hour}:00</span>
          <input aria-label="Sun time of day" type="range" min="5" max="20" step="0.25" value={hour} onChange={(event) => setHour(Number(event.target.value))} />
          <small>{seasonName(day)}</small>
        </label>
        <div className="science-seasons" aria-label="Season presets">
          <button type="button" className={day === 355 ? 'active' : ''} onClick={() => setDay(355)}>Dec</button>
          <button type="button" className={day === 80 ? 'active' : ''} onClick={() => setDay(80)}>Mar</button>
          <button type="button" className={day === 172 ? 'active' : ''} onClick={() => setDay(172)}>Jun</button>
        </div>
        <label className="outside-temperature">
          Outside
          <input aria-label="Outside air temperature" type="number" min="-30" max="55" value={outsideC} onChange={(event) => setOutsideC(Number(event.target.value))} />
          <span>°C</span>
        </label>
        <details className="science-method">
          <summary aria-label="How the heat snapshot is calculated"><CircleHelp /> Method</summary>
          <div>
            <strong>What this number means</strong>
            <p><b>Transmission:</b> U × area × temperature difference. <b>Sun:</b> 800 W/m² clear-sky beam × glass area × SHGC × angle.</p>
            <p>Inside is held at 26°C. Current assumptions: {heat.exteriorWallM2.toFixed(1)} m² opaque wall, {heat.windowM2.toFixed(1)} m² glass, {heat.doorM2.toFixed(1)} m² doors.</p>
            <p className="science-caveat">Not included: roof, floor, air leaks, clouds, trees, overhangs, people or equipment. Use it to compare moves—not size an AC system.</p>
            <nav aria-label="Method sources">
              <a href="https://www.energy.gov/cmei/femp/purchasing-energy-efficient-residential-windows-doors-and-skylights" target="_blank" rel="noreferrer">DOE · U-factor & SHGC</a>
              <a href="https://midcdmz.nrel.gov/spa/" target="_blank" rel="noreferrer">NREL · solar position</a>
              <a href="https://www.wbdg.org/resources/natural-ventilation" target="_blank" rel="noreferrer">WBDG · ventilation</a>
            </nav>
          </div>
        </details>
      </div>
    </section>
  )
})
