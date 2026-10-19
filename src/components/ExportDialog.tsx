import { useEffect, useMemo, useRef, useState } from 'react'
import { meshTo3mf, meshToBinaryStl, meshToGlb } from '../fabricate/formats'
import { houseMesh, scaleToPrint } from '../fabricate/houseMesh'
import { BASE_PRINT_MM, BUILD_PLATE_MM, checkPrint, PRINT_SCALES, PROCESS_LIMITS, recommendScale, type PrintProcess } from '../fabricate/printability'
import { planToDxf } from '../export/planExchange'
import type { PlanState } from '../types'
import { useI18n } from '../i18n'

function download(bytes: Uint8Array, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const mm = (value: number) => (value >= 10 ? Math.round(value).toString() : value.toFixed(1))

export function ExportDialog({ plan, baseName, onClose, onExportProject, onDone }: {
  plan: PlanState
  baseName: string
  onClose: () => void
  onExportProject: () => void
  onDone: (message: string) => void
}) {
  const { tr } = useI18n()
  const dialog = useRef<HTMLDialogElement>(null)
  const [error, setError] = useState('')
  const save = (makeBytes: () => Uint8Array, filename: string, mime: string, message: string) => {
    try { download(makeBytes(), filename, mime); onDone(message) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not export this model. Review the plan and try again.') }
  }
  const [process, setProcess] = useState<PrintProcess>('fdm')
  const [thicken, setThicken] = useState(true)
  const recommended = useMemo(() => recommendScale(plan, process, thicken), [plan, process, thicken])
  const [scale, setScale] = useState<number>(() => recommendScale(plan, 'fdm', true)?.denominator ?? 100)
  const check = useMemo(() => checkPrint(plan, scale, process, thicken), [plan, scale, process, thicken])
  const hasWalls = plan.rooms.some((room) => room.kind !== 'terrace')
  const limits = PROCESS_LIMITS[process]
  useEffect(() => { dialog.current?.showModal() }, [])

  const printParts = () => {
    const baseM = (BASE_PRINT_MM * scale) / 1000
    const mesh = houseMesh(plan, { wallM: (check.printedWallMm * scale) / 1000, baseM })
    return scaleToPrint(mesh, scale, baseM)
  }
  const fileStem = `${baseName}-1-${scale}`

  return <dialog ref={dialog} className="trace-review export-dialog" aria-labelledby="export-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <h2 id="export-title">{tr('Take the design out')}</h2>
    {error && <p role="alert">{error}</p>}

    <section className="export-option">
      <div><h3>{tr('Project file')}</h3><p>{tr('Everything you drew, for designon. Reopen it with Import.')}</p></div>
      <button className="button secondary" type="button" onClick={() => { onExportProject(); onClose() }}>.json</button>
    </section>

    <section className="export-option">
      <div><h3>{tr('3D model')}</h3><p>Walls with real door and window openings, in metres. Opens in Blender, Windows 3D Viewer and online model viewers. No roof, so you can look in.</p></div>
      <button className="button secondary" type="button" disabled={!hasWalls} onClick={() => {
        save(() => meshToGlb(houseMesh(plan).parts, baseName), `${baseName}.glb`, 'model/gltf-binary', '3D model downloaded (.glb, metres)')
      }}>.glb</button>
    </section>

    <section className="export-option">
      <div><h3>{tr('2D CAD drawing')}</h3><p>Rooms and pencil walls as metre LINE entities, plan north up. Opens in AutoCAD, BricsCAD, DraftSight, LibreCAD and anything that reads DXF — to trace, dimension or carry the outline into another tool.</p></div>
      <button className="button secondary" type="button" disabled={!plan.rooms.length && !plan.walls?.length} onClick={() => {
        save(() => new TextEncoder().encode(planToDxf(plan)), `${baseName}.dxf`, 'image/vnd.dxf', '2D CAD drawing downloaded (.dxf, metres, north up)')
      }}>.dxf</button>
    </section>

    <section className="export-option export-print">
      <div>
        <h3>{tr('3D print a scale model')}</h3>
        <p>A roofless model on a {BASE_PRINT_MM} mm base, for review in a slicer such as Bambu Studio, PrusaSlicer or Cura.</p>
      </div>
      <div className="trace-fields">
        <label>{tr('Scale')}<select aria-label="Scale" value={scale} onChange={event => setScale(Number(event.target.value))}>
          {PRINT_SCALES.map(d => <option key={d} value={d}>1:{d}{recommended?.denominator === d ? ' (recommended)' : ''}</option>)}
        </select></label>
        <label>{tr('Printer')}<select aria-label="Printer" value={process} onChange={event => setProcess(event.target.value as PrintProcess)}>
          {(Object.keys(PROCESS_LIMITS) as PrintProcess[]).map(p => <option key={p} value={p}>{PROCESS_LIMITS[p].label}</option>)}
        </select></label>
      </div>
      <label className="export-check"><input type="checkbox" checked={thicken} onChange={event => setThicken(event.target.checked)} /> Thicken walls that are too thin to print</label>

      {hasWalls ? <ul className="export-verdict">
        <li className={check.fits ? 'is-ok' : 'is-fail'}>
          Model {mm(check.sizeMm.x)} × {mm(check.sizeMm.y)} × {mm(check.sizeMm.z)} mm — {check.fits ? `fits a ${BUILD_PLATE_MM} mm plate` : `larger than a ${BUILD_PLATE_MM} mm plate; choose a smaller scale`}
        </li>
        <li className={check.wallOk ? 'is-ok' : 'is-fail'}>
          {check.thickened
            ? `Walls thickened from ${mm(check.wallMm)} to ${mm(check.printedWallMm)} mm to meet the thickness default. The model is not true to scale in wall thickness.`
            : `Walls ${mm(check.wallMm)} mm, true to scale — ${check.wallOk ? `above the ${limits.minUnsupportedWallMm} mm minimum` : `below the ${limits.minUnsupportedWallMm} mm minimum; they may break or not print`}`}
        </li>
        {check.bridgeMm > 0 && <li className={check.bridgeOk ? 'is-ok' : 'is-warn'}>
          Longest beam over an opening {mm(check.bridgeMm)} mm — {check.bridgeOk ? `within the ${limits.maxBridgeMm} mm bridge limit` : `over the ${limits.maxBridgeMm} mm bridge limit; turn on supports in your slicer`}
        </li>}
      </ul> : <p role="alert">{tr('Draw at least one room with walls to print a model.')}</p>}

      <p className="export-source">Limits are conservative defaults from the design-for-printing guide in text-to-cad (Hubs and Formlabs guides, ISO/ASTM 52910). The {BUILD_PLATE_MM} mm plate is an assumption; check your printer’s width, depth and height. This checks dimensions and wall thickness, not print success. Review supports and toolpaths in your slicer.</p>
      <div className="trace-actions">
        <button className="button secondary" type="button" disabled={!hasWalls || !check.ok} onClick={() => {
          save(() => meshToBinaryStl(printParts(), baseName), `${fileStem}.stl`, 'model/stl', `Scale model 1:${scale} downloaded (.stl)`)
        }}>.stl</button>
        <button className="button primary" type="button" disabled={!hasWalls || !check.ok} onClick={() => {
          save(() => meshTo3mf(printParts(), baseName), `${fileStem}.3mf`, 'model/3mf', `Scale model 1:${scale} downloaded (.3mf)`)
        }}>{tr('Download .3mf')}</button>
      </div>
    </section>

    <div className="trace-actions"><button className="button secondary" type="button" onClick={onClose}>{tr('Close')}</button></div>
  </dialog>
}
