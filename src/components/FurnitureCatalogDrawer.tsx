import React, { useEffect, useMemo, useRef, useState } from 'react'
import { X, Bed, Armchair, Monitor, Utensils, Flower2, Tv, LayoutGrid, Layers, Bath, Lamp } from 'lucide-react'
import { furnitureCatalog, furnitureLabelFor, furnitureRectFor, siteOf } from '../plan'
import type { FurnitureKind, PlanState } from '../types'
import { furnitureAssetById } from '../catalog/furnitureAssets'
import { findFurniturePlacement } from '../canvas/furniturePlacement'
import { prepareFurnitureReplacement, type FurnitureChoice } from '../canvas/furnitureReplacement'

interface FurnitureCatalogDrawerProps {
  plan: PlanState
  roomId: string | null
  onRoomChange: (id: string | null) => void
  replacementId: string | null
  replacementChoice: FurnitureChoice | null
  onPreviewReplacement: (choice: FurnitureChoice | null) => void
  onApplyReplacement: () => void
  onInspectReplacement: () => void
  inspecting: boolean
  open: boolean
  onClose: () => void
  onAddFurniture: (kind: FurnitureKind, label: string, size?: { wM: number; dM: number }, assetId?: string) => boolean
}

interface CatalogItem {
  kind: FurnitureKind
  label: string
  category: 'bedroom' | 'living' | 'office' | 'dining' | 'decor' | 'bath'
  /** Explicit footprint override. Omitted = the generic kind spec. */
  size?: { wM: number; dM: number }
  assetId?: string
  icon: typeof Bed
}

function measuredItem(
  assetId: string,
  kind: FurnitureKind,
  category: CatalogItem['category'],
  icon: CatalogItem['icon'],
): CatalogItem {
  const asset = furnitureAssetById(assetId)
  if (!asset) throw new Error(`Missing generated furniture asset: ${assetId}`)
  return {
    kind,
    label: asset.label,
    category,
    size: { wM: asset.widthM, dM: asset.depthM },
    assetId,
    icon,
  }
}

const CATALOG_ITEMS: CatalogItem[] = [
  { kind: 'bed', label: 'King Bed & Nightstands', category: 'bedroom', size: { wM: 2.0, dM: 2.0 }, icon: Bed },
  { kind: 'bed', label: 'Single Bed', category: 'bedroom', size: { wM: 1.2, dM: 2.0 }, icon: Bed },
  measuredItem('glam-velvet-sofa', 'sofa', 'living', Armchair),
  measuredItem('wood-leather-sofa', 'sofa', 'living', Armchair),
  { kind: 'sofa', label: 'L-Shape Sectional', category: 'living', size: { wM: 2.8, dM: 1.8 }, icon: Armchair },
  { kind: 'desk', label: 'Executive Workstation', category: 'office', size: { wM: 1.6, dM: 0.8 }, icon: Monitor },
  { kind: 'dining', label: '6-Person Dining Table', category: 'dining', size: { wM: 1.8, dM: 0.9 }, icon: Utensils },
  { kind: 'console', label: 'Media & TV Console', category: 'living', size: { wM: 2.0, dM: 0.4 }, icon: Tv },
  { kind: 'wardrobe', label: 'Built-in Wardrobe', category: 'bedroom', size: { wM: 2.0, dM: 0.6 }, icon: LayoutGrid },
  // `chair`, not `sofa`: the kind is what the plan prints under the piece, and a
  // chair labelled "Sofa" is a lie in the one label a reader is guaranteed to see.
  measuredItem('sheen-chair', 'chair', 'living', Flower2),
  measuredItem('damask-chair', 'chair', 'living', Flower2),
  { kind: 'wc', label: 'WC', category: 'bath', size: { wM: 0.4, dM: 0.7 }, icon: Bath },
  // Sizes are the measured geometry of the real catalogue meshes, so placing
  // either of these needs no scaling and the 3D view matches the plan exactly.
  measuredItem('glass-vase', 'decor', 'decor', Flower2),
  measuredItem('lantern', 'decor', 'decor', Lamp),
]

/**
 * Slide-out furniture catalog. Sharp edges, hairline border, monospace
 * dimensions, no glass, no shadow — per the Axiom Design Core.
 */
export const FurnitureCatalogDrawer: React.FC<FurnitureCatalogDrawerProps> = ({
  open,
  onClose,
  onAddFurniture, plan, roomId, onRoomChange, replacementId, replacementChoice, onPreviewReplacement, onApplyReplacement, onInspectReplacement, inspecting,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [placementError, setPlacementError] = useState(false)

  const [fitOnly, setFitOnly] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const replacing = plan.furniture.find(item => item.id === replacementId)
  const choiceFor = (item: CatalogItem): FurnitureChoice => ({ kind: item.kind, label: item.label, wM: item.size?.wM ?? furnitureCatalog[item.kind].w, dM: item.size?.dM ?? furnitureCatalog[item.kind].d, ...(item.assetId ? { assetId: item.assetId } : {}) })
  const availability = useMemo(() => {
    if (!open) return []
    return CATALOG_ITEMS.map(item => {
      const choice = choiceFor(item)
      if (replacementId) return prepareFurnitureReplacement(plan, replacementId, choice).error ?? null
      return findFurniturePlacement(plan, { ...choice, id: '__catalogue_trial__', x: 0, y: 0, rotated: false }, roomId) ? null : 'Could not find clear space at real size.'
    })
  }, [open, plan, replacementId, roomId])
  const trial = replacementId && replacementChoice ? prepareFurnitureReplacement(plan, replacementId, replacementChoice) : null
  const trialRect = trial?.item ? furnitureRectFor(trial.item, siteOf(plan)) : null
  const trialRoom = trialRect ? plan.rooms.find(room => trialRect.x >= room.x && trialRect.y >= room.y && trialRect.x + trialRect.w <= room.x + room.w && trialRect.y + trialRect.h <= room.y + room.h) : null
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault(); event.stopImmediatePropagation(); onClose()
    }
    window.addEventListener('keydown', dismiss, true)
    return () => { window.removeEventListener('keydown', dismiss, true); if (previous?.isConnected) previous.focus(); else (document.querySelector<HTMLElement>('.spatial-furniture-tools button') ?? document.querySelector<HTMLElement>('.spatial-furniture-tools select'))?.focus() }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    if (inspecting) document.querySelector<HTMLElement>('.spatial-trial-controls button')?.focus()
    else searchRef.current?.focus()
  }, [open, inspecting])

  if (!open) return null

  const categories = [
    { id: 'all', label: 'All Items' },
    { id: 'bedroom', label: 'Bedroom' },
    { id: 'living', label: 'Living' },
    { id: 'office', label: 'Office' },
    { id: 'dining', label: 'Dining' },
    { id: 'decor', label: 'Decor' },
    { id: 'bath', label: 'Bath' },
  ]

  const needle = searchQuery.trim().toLowerCase()
  const dimension = (value: number) => value < 1 ? value.toFixed(2) : value.toFixed(1)
  const filteredItems = CATALOG_ITEMS.map((item, index) => ({ item, error: availability[index] })).filter(({ item, error }) => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory
    const matchesSearch =
      needle === '' ||
      item.label.toLowerCase().includes(needle) ||
      item.kind.toLowerCase().includes(needle) ||
      item.category.toLowerCase().includes(needle)
    return matchesCategory && matchesSearch && (!fitOnly || !error)
  })

  return (
    <aside className={`furniture-catalog-drawer ${inspecting && trial?.item ? 'is-inspecting' : ''}`} aria-label="Furniture catalog">
      <header className="catalog-header">
        <div className="catalog-title">
          <Layers className="catalog-title-icon" aria-hidden="true" />
          <h4>{replacementId ? 'Replace furniture' : 'Furniture Catalog'}</h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="catalog-close"
          title="Close catalog"
          aria-label="Close catalog"
        >
          <X className="catalog-close-icon" aria-hidden="true" />
        </button>
      </header>

      <div className="catalog-search catalog-browse">
        <input
          ref={searchRef}
          type="search"
          placeholder="Filter by name or kind"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          aria-label="Filter furniture catalog"
        />
      </div>

      <div className="catalog-target catalog-browse">
        {replacementId ? <p>Replace <strong>{replacing ? furnitureLabelFor(replacing) : 'removed piece'}</strong>. Position and orientation stay fixed.</p> : <label>Place in room
          <select aria-label="Place in room" value={roomId ?? ''} onChange={event => { onRoomChange(event.target.value || null); setPlacementError(false) }}>
            <option value="">Any room with space</option>
            {plan.rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
        </label>}
        <label className="catalog-fit"><input type="checkbox" checked={fitOnly} onChange={event => setFitOnly(event.target.checked)} />{replacementId ? 'Fits here only' : 'Fits room only'}</label>
      </div>
      {replacementId && <section className="catalog-trial" aria-label="Replacement preview">
        {replacementChoice ? <>
          <strong>{replacementChoice.label}</strong>
          <span>{replacementChoice.wM.toFixed(2)} × {replacementChoice.dM.toFixed(2)} m · {replacementChoice.assetId ? 'measured 3D' : 'schematic'}</span>
          {trial?.error ? <p role="alert">{trial.error}</p> : <>
            <p>Preview only — orbit the model or change the view. The saved drawing and checks stay unchanged until Apply.</p>
            {trialRoom && trialRect && <svg className="catalog-trial-plan" viewBox={`0 0 ${trialRoom.w * siteOf(plan).w} ${trialRoom.h * siteOf(plan).h}`} role="img" aria-label="Replacement footprint in its room">
              <rect x="0" y="0" width={trialRoom.w * siteOf(plan).w} height={trialRoom.h * siteOf(plan).h} className="catalog-room-outline" />
              {plan.furniture.filter(item => item.id !== replacementId).map(item => { const r = furnitureRectFor(item, siteOf(plan)); return <rect key={item.id} x={(r.x - trialRoom.x) * siteOf(plan).w} y={(r.y - trialRoom.y) * siteOf(plan).h} width={r.w * siteOf(plan).w} height={r.h * siteOf(plan).h} className="catalog-other-piece" /> })}
              <rect x={(trialRect.x - trialRoom.x) * siteOf(plan).w} y={(trialRect.y - trialRoom.y) * siteOf(plan).h} width={trialRect.w * siteOf(plan).w} height={trialRect.h * siteOf(plan).h} className="catalog-new-piece" />
            </svg>}
          </>}
        </> : <p>Choose a piece below to try it at the same centre, at its real size.</p>}
        <div className="catalog-trial-actions">
          {trial?.item && <button type="button" onClick={onInspectReplacement}>{inspecting ? 'Back to choices' : 'Inspect in 3D'}</button>}
          <button type="button" onClick={onApplyReplacement} disabled={!trial?.item}>Apply replacement</button>
          <button type="button" onClick={onClose}>Cancel</button>
          {replacementChoice && <button type="button" onClick={() => onPreviewReplacement(null)}>Clear preview</button>}
        </div>
      </section>}
      <nav className="catalog-tabs catalog-browse" aria-label="Categories">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCategory(c.id)}
            className={`catalog-tab ${activeCategory === c.id ? 'is-active' : ''}`}
            aria-pressed={activeCategory === c.id}
          >
            {c.label}
          </button>
        ))}
      </nav>

      {placementError && <p className="catalog-empty" role="alert">Could not find clear space at real size. Try a smaller piece, or close the catalogue and choose another room.</p>}
      <div className="catalog-grid catalog-browse">
        {filteredItems.length === 0 ? (
          <p className="catalog-empty">No pieces match that filter.</p>
        ) : (
          filteredItems.map(({ item, error }, idx) => {
            const Icon = item.icon
            const size = item.size ?? { wM: furnitureCatalog[item.kind].w, dM: furnitureCatalog[item.kind].d }
            const dimensions = `${dimension(size.wM)} × ${dimension(size.dM)} m`
            return (
              <button
                key={`${item.kind}-${idx}`}
                type="button"
                onClick={() => replacementId ? onPreviewReplacement(choiceFor(item)) : setPlacementError(!onAddFurniture(item.kind, item.label, item.size, item.assetId))}
                className="catalog-card"
                aria-label={`${replacementId ? 'Try' : 'Add'} ${item.label}, ${dimensions}`}
                aria-pressed={replacementId ? replacementChoice?.label === item.label : undefined}
              >
                <span className="catalog-card-icon" aria-hidden="true">
                  <Icon className="catalog-card-icon-svg" />
                </span>
                <strong className="catalog-card-name">{item.label}</strong>
                <span className="catalog-card-dim">{dimensions}{item.assetId ? ' · measured 3D' : ' · schematic'}</span>
                <span className="catalog-fit-result">{error ? (replacementId ? 'Does not fit here' : 'No clear space found') : (replacementId ? 'Fits here' : 'Clear space found')}</span>
              </button>
            )
          })
        )}
      </div>
      <p className="catalog-credit catalog-browse">
        Measured 3D assets · CC0 / CC BY 4.0 ·{' '}
        <a href={`${import.meta.env.BASE_URL}licenses/furniture.txt`} target="_blank" rel="noreferrer">credits</a>
      </p>
    </aside>
  )
}
