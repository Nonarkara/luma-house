import React from 'react'
import { Zap, Sun, Leaf, Flame, Wind, Clock } from 'lucide-react'
import type { EnergySimulationResult } from '../analysis/energySimulation'
import type { AirQualityReport } from '../analysis/airQuality'

interface EnergySimulationCardProps {
  energy: EnergySimulationResult
  airQuality?: AirQualityReport
}

export const EnergySimulationCard: React.FC<EnergySimulationCardProps> = ({ energy, airQuality }) => {
  const ratingColors: Record<EnergySimulationResult['energyRating'], string> = {
    'A+': '#10b981',
    A: '#059669',
    B: '#10b981',
    C: '#84cc16',
    D: '#f59e0b',
    E: '#f97316',
    F: '#ef4444',
    G: '#b91c1c',
  }

  const badgeColor = ratingColors[energy.energyRating]

  return (
    <section className="panel-section energy-simulation-card" style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <div className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap style={{ width: 18, height: 18, color: badgeColor }} />
          <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Operational EUI & Carbon Payback</h3>
        </div>
        <span
          className="badge"
          style={{
            background: `${badgeColor}22`,
            color: badgeColor,
            border: `1px solid ${badgeColor}55`,
            fontSize: '0.8rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 12,
          }}
        >
          Class {energy.energyRating} Energy
        </span>
      </div>

      <p className="section-intro" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
        Annual building energy balance simulation (kWh/m²/yr) including envelope transmission, HVAC ventilation, internal gains, and solar PV yield.
      </p>

      {/* Main EUI & Payback Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div style={{ background: 'rgba(0, 0, 0, 0.18)', padding: 10, borderRadius: 6 }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Net EUI</span>
          <strong style={{ fontSize: '1.1rem', color: badgeColor }}>
            {energy.netEuiKwhPerM2Yr.toFixed(1)} <small style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>kWh/m²/yr</small>
          </strong>
          <small style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {energy.annualOperationalCarbonKg.toLocaleString()} kgCO₂e/yr emissions
          </small>
        </div>

        <div style={{ background: 'rgba(0, 0, 0, 0.18)', padding: 10, borderRadius: 6 }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Carbon Neutral Payback</span>
          <strong style={{ fontSize: '1.1rem', color: 'var(--accent-emerald, #10b981)' }}>
            {energy.carbonNeutralityPaybackYears ? `${energy.carbonNeutralityPaybackYears} yrs` : 'N/A'}
          </strong>
          <small style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
            <Clock style={{ width: 10, height: 10, display: 'inline', marginRight: 2 }} />
            embodied carbon ROI
          </small>
        </div>
      </div>

      {/* Breakdown List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><Flame style={{ width: 12, height: 12, display: 'inline', marginRight: 4, color: '#f59e0b' }} /> Heating Demand:</span>
          <strong>{energy.heatingDemandKwhPerM2Yr.toFixed(1)} kWh/m²/yr</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><Wind style={{ width: 12, height: 12, display: 'inline', marginRight: 4, color: '#38bdf8' }} /> Cooling Demand:</span>
          <strong>{energy.coolingDemandKwhPerM2Yr.toFixed(1)} kWh/m²/yr</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span><Sun style={{ width: 12, height: 12, display: 'inline', marginRight: 4, color: '#eab308' }} /> Solar PV Yield:</span>
          <strong style={{ color: '#10b981' }}>−{energy.solarPvGenerationKwhPerM2Yr.toFixed(1)} kWh/m²/yr</strong>
        </div>
      </div>

      {/* IAQ CO2 Status if available */}
      {airQuality && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255, 255, 255, 0.08)', fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)' }}><Leaf style={{ width: 12, height: 12, display: 'inline', marginRight: 4, color: '#10b981' }} /> Indoor Air Quality (CO₂):</span>
            <strong style={{ color: airQuality.overallIaq === 'POOR' ? '#ef4444' : airQuality.overallIaq === 'MODERATE' ? '#f59e0b' : '#10b981' }}>
              {airQuality.averageCo2Ppm} ppm ({airQuality.overallIaq})
            </strong>
          </div>
        </div>
      )}
    </section>
  )
}
