import { useState } from 'react'
import type { PlanState, ProjectLocation } from '../types'
import { clockLabel } from '../location/solar'
import { geometryFingerprint } from './geometry'
import { MAX_STUDY_SCENES, readPreviews, savePreview } from './scenes'
import type { StudyCapture, StudyScene, StudySettings } from './types'
import { StudyDialog, StudySheet } from './StudySheet'

const previewId = (scene: StudyScene) => `${scene.id}-${Date.parse(scene.capturedAt)}`
export function StudyPanel({ plan, title, location, day, hour, year, settings, capture, restore, onScenesChange, onTimeChange, disabled }: {
  plan: PlanState; title: string; location: ProjectLocation; day: number; hour: number; year: number
  settings: StudySettings; capture: () => Promise<StudyCapture>; restore: (scene: StudyScene) => void
  onScenesChange: (scenes: StudyScene[]) => void; onTimeChange: (day: number, hour: number, year: number) => void; disabled: boolean
}) {
  const [open, setOpen] = useState(false), [sheet, setSheet] = useState<StudyCapture | null>(null)
  const [previews, setPreviews] = useState(readPreviews)
  const [name, setName] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const scenes = plan.studyScenes ?? []
  const remember = (scene: StudyScene, image: string) => {
    setPreviews(current => ({ ...current, [previewId(scene)]: image }))
    return savePreview(previewId(scene), image)
  }
  const makeScene = (view: StudyCapture, sceneName: string, time: number, id: string = crypto.randomUUID()): StudyScene => ({
    id, name: sceneName, capturedAt: new Date().toISOString(), geometryKey: geometryFingerprint(plan, settings.roofStyle),
    location: { ...location }, day, hour: time, year, camera: view.camera, settings: { ...settings },
  })
  const save = async (replace?: StudyScene) => {
    setBusy(true); setMessage('Capturing this drawing…')
    try {
      const view = await capture()
      const scene = makeScene(view, name.trim() || replace?.name || `${clockLabel(hour)} sun study`, hour, replace?.id)
      const saved = remember(scene, view.image)
      onScenesChange(replace ? scenes.map(s => s.id === replace.id ? scene : s) : [...scenes, scene])
      setName(''); setMessage(saved ? 'View added to project; preview cached on this device.' : 'View added to project. Preview is available this visit; use Share if local saving is unavailable.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not capture the 3D view.') }
    finally { setBusy(false) }
  }
  const compare = async () => {
    setBusy(true); setMessage('Capturing three times from the same camera…')
    try {
      const added: StudyScene[] = []
      let saved = true
      for (const [label, time] of [['Morning', 9], ['Midday', 12], ['Afternoon', 15]] as const) {
        onTimeChange(day, time, year)
        const view = await capture()
        const scene = makeScene(view, `${label} ${clockLabel(time)}`, time)
        saved = remember(scene, view.image) && saved
        added.push(scene)
      }
      onScenesChange([...scenes, ...added])
      setMessage(saved ? 'Three sun views added to project from the same camera.' : 'Three views added to project; previews are available this visit. Use Share if local saving is unavailable.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not capture the comparison.') }
    finally { onTimeChange(day, hour, year); setBusy(false) }
  }
  const showSheet = async () => {
    setBusy(true); setMessage('')
    try { setSheet(await capture()) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not prepare the sheet.'); setOpen(true) }
    finally { setBusy(false) }
  }
  const date = new Date(Date.UTC(year, 0, day)).toISOString().slice(0, 10)
  return <>
    <div className="study-launchers"><button type="button" disabled={disabled || busy} onClick={() => setOpen(true)}>Saved views</button><button type="button" disabled={disabled || busy} onClick={showSheet}>{busy && !open ? 'Preparing…' : 'Study sheet'}</button></div>
    {open && <StudyDialog label="Saved study views" close={() => { if (!busy) setOpen(false) }}>
      <div className="study-dialog-controls"><strong>Saved study views</strong><button type="button" disabled={busy} onClick={() => setOpen(false)}>Close saved views</button></div>
      <p>Save a viewpoint and its sun settings. Previews record the drawing at capture time; opening a view uses your current drawing.</p>
      <div className="study-scene-inputs">
        <label>View name<input aria-label="Study view name" maxLength={64} value={name} disabled={busy} onChange={e => setName(e.target.value)} placeholder={`${clockLabel(hour)} sun study`} /></label>
        <label>Date<input type="date" aria-label="Study date" min="2000-01-01" max="2100-12-31" value={date} disabled={busy} onChange={e => {
          const value = e.target.value, next = new Date(`${value}T12:00:00Z`)
          if (!value || !Number.isFinite(next.getTime()) || next.getUTCFullYear() < 2000 || next.getUTCFullYear() > 2100) return
          const y = next.getUTCFullYear(), d = Math.floor((next.getTime() - Date.UTC(y, 0, 1)) / 86400000) + 1
          onTimeChange(d, hour, y)
        }} /></label>
        <label>Local time<input type="time" aria-label="Study local time" step={900} value={clockLabel(hour === 24 ? 0 : hour)} disabled={busy} onChange={e => { if (/^\d{2}:\d{2}$/.test(e.target.value)) { const [h, m] = e.target.value.split(':').map(Number); onTimeChange(day, h + m / 60, year) } }} /></label>
      </div>
      <div className="study-save-actions"><button type="button" disabled={busy || scenes.length >= MAX_STUDY_SCENES} onClick={() => save()}>Save current view</button><button type="button" disabled={busy || scenes.length > MAX_STUDY_SCENES - 3} onClick={compare}>Compare 09:00 / 12:00 / 15:00</button><span>{scenes.length}/{MAX_STUDY_SCENES} views · {location.timezone}</span></div>
      {message && <p role="status">{message}</p>}
      {!scenes.length && <p className="study-empty">No saved views yet. Frame your model, then save a view or compare three sun times.</p>}
      <div className="study-scene-grid">{scenes.map(scene => <article key={scene.id}>
        {previews[previewId(scene)] ? <img src={previews[previewId(scene)]} alt={`Captured drawing: ${scene.name}`} /> : <div className="study-no-preview">Preview on the original device · open the view to inspect it here</div>}
        <strong>{scene.name}</strong><span>{scene.location.name} · {new Date(Date.UTC(scene.year, 0, scene.day)).toISOString().slice(0, 10)} · {clockLabel(scene.hour)}</span>
        <small>{scene.geometryKey === geometryFingerprint(plan, scene.settings.roofStyle) ? 'Captured from this drawing' : 'Earlier drawing · update preview to refresh'}</small>
        <div><button type="button" disabled={busy} onClick={() => { restore(scene); setOpen(false) }}>Open {scene.name}</button><button type="button" disabled={busy} onClick={() => save(scene)} aria-label={`Replace ${scene.name} with current view`}>Update</button><button type="button" disabled={busy} onClick={() => onScenesChange(scenes.filter(s => s.id !== scene.id))} aria-label={`Remove ${scene.name}`}>Remove</button></div>
      </article>)}</div>
    </StudyDialog>}
    {sheet && <StudySheet plan={plan} title={title} location={location} day={day} hour={hour} year={year} settings={settings} capture={sheet} close={() => setSheet(null)} />}
  </>
}
