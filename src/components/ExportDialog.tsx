import { useEffect, useMemo, useRef, useState } from 'react'
import { meshTo3mf, meshToBinaryStl, meshToGlb } from '../fabricate/formats'
import { houseMesh, scaleToPrint } from '../fabricate/houseMesh'
import { BASE_PRINT_MM, BUILD_PLATE_MM, checkPrint, PRINT_SCALES, PROCESS_LIMITS, recommendScale, type PrintProcess } from '../fabricate/printability'
import type { PlanState } from '../types'

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
  const dialog = useRef<HTMLDialogElement>(null)
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
    <h2 id="export-title">Take the design out</h2>

    <section className="export-option">
      <div><h3>Project file</h3><p>Everything you drew, for designon. Reopen it with Import.</p></div>
      <button className="button secondary" type="button" onClick={() => { onExportProject(); onClose() }}>.json</button>
    </section>

    <section className="export-option">
      <div><h3>3D model</h3><p>Walls with real door and window openings, in metres. Opens in Blender, Windows 3D Viewer and online model viewers. No roof, so you can look in.</p></div>
      <button className="button secondary" type="button" disabled={!hasWalls} onClick={() => {
        download(meshToGlb(houseMesh(plan).parts, baseName), `${baseName}.glb`, 'model/gltf-binary')
        onDone('3D model downloaded (.glb, metres)')
      }}>.glb</button>
    </section>

    <section className="export-option export-print">
      <div>
        <h3>3D print a scale model</h3>
        <p>A roofless model on a {BASE_PRINT_MM} mm base, ready for a slicer such as Bambu Studio, PrusaSlicer or Cura.</p>
      </div>
      <div className="trace-fields">
        <label>Scale<select value={scale} onChange={event => setScale(Number(event.target.value))}>
          {PRINT_SCALES.map(d => <option key={d} value={d}>1:{d}{recommended?.denominator === d ? ' (recommended)' : ''}</option>)}
        </select></label>
        <label>Printer<select value={process} onChange={event => setProcess(event.target.value as PrintProcess)}>
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
            ? `Walls thickened from ${mm(check.wallMm)} to ${mm(check.printedWallMm)} mm so they print. The model is not true to scale in wall thickness.`
            : `Walls ${mm(check.wallMm)} mm, true to scale — ${check.wallOk ? `above the ${limits.minUnsupportedWallMm} mm minimum` : `below the ${limits.minUnsupportedWallMm} mm minimum; they may break or not print`}`}
        </li>
        {check.bridgeMm > 0 && <li className={check.bridgeOk ? 'is-ok' : 'is-warn'}>
          Longest beam over an opening {mm(check.bridgeMm)} mm — {check.bridgeOk ? `within the ${limits.maxBridgeMm} mm bridge limit` : `over the ${limits.maxBridgeMm} mm bridge limit; turn on supports in your slicer`}
        </li>}
      </ul> : <p role="alert">Draw at least one room with walls to print a model.</p>}

      <p className="export-source">Limits are conservative defaults from the design-for-printing guide in text-to-cad (Hubs and Formlabs guides, ISO/ASTM 52910). The {BUILD_PLATE_MM} mm plate is an assumption; check your printer.</p>
      <div className="trace-actions">
        <button className="button secondary" type="button" disabled={!hasWalls || !check.ok} onClick={() => {
          download(meshToBinaryStl(printParts(), baseName), `${fileStem}.stl`, 'model/stl')
          onDone(`Scale model 1:${scale} downloaded (.stl)`)
        }}>.stl</button>
        <button className="button primary" type="button" disabled={!hasWalls || !check.ok} onClick={() => {
          download(meshTo3mf(printParts(), baseName), `${fileStem}.3mf`, 'model/3mf')
          onDone(`Scale model 1:${scale} downloaded (.3mf)`)
        }}>Download .3mf</button>
      </div>
    </section>

    <div className="trace-actions"><button className="button secondary" type="button" onClick={onClose}>Close</button></div>
  </dialog>
}
