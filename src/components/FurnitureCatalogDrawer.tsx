import React, { useState } from 'react'
import { X, Bed, Armchair, Monitor, Utensils, Flower2, Tv, LayoutGrid, Layers, Bath, Lamp } from 'lucide-react'
import { furnitureCatalog } from '../plan'
import type { FurnitureKind } from '../types'
import { furnitureAssetById } from '../catalog/furnitureAssets'

interface FurnitureCatalogDrawerProps {
  open: boolean
  onClose: () => void
  onAddFurniture: (kind: FurnitureKind, label: string, size?: { wM: number; dM: number }, assetId?: string) => void
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
  onAddFurniture,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

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
  const filteredItems = CATALOG_ITEMS.filter((item) => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory
    const matchesSearch =
      needle === '' ||
      item.label.toLowerCase().includes(needle) ||
      item.kind.toLowerCase().includes(needle) ||
      item.category.toLowerCase().includes(needle)
    return matchesCategory && matchesSearch
  })

  return (
    <aside className="furniture-catalog-drawer" aria-label="Furniture catalog">
      <header className="catalog-header">
        <div className="catalog-title">
          <Layers className="catalog-title-icon" aria-hidden="true" />
          <h4>Furniture Catalog</h4>
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

      <div className="catalog-search">
        <input
          type="search"
          placeholder="Filter by name or kind"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          aria-label="Filter furniture catalog"
        />
      </div>

      <nav className="catalog-tabs" aria-label="Categories">
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

      <div className="catalog-grid">
        {filteredItems.length === 0 ? (
          <p className="catalog-empty">No pieces match that filter.</p>
        ) : (
          filteredItems.map((item, idx) => {
            const Icon = item.icon
            const size = item.size ?? { wM: furnitureCatalog[item.kind].w, dM: furnitureCatalog[item.kind].d }
            const dimensions = `${dimension(size.wM)} × ${dimension(size.dM)} m`
            return (
              <button
                key={`${item.kind}-${idx}`}
                type="button"
                onClick={() => onAddFurniture(item.kind, item.label, item.size, item.assetId)}
                className="catalog-card"
                aria-label={`Add ${item.label}, ${dimensions}`}
              >
                <span className="catalog-card-icon" aria-hidden="true">
                  <Icon className="catalog-card-icon-svg" />
                </span>
                <strong className="catalog-card-name">{item.label}</strong>
                <span className="catalog-card-dim">{dimensions}{item.assetId ? ' · measured 3D' : ''}</span>
              </button>
            )
          })
        )}
      </div>
      <p className="catalog-credit">
        Measured 3D assets · CC0 / CC BY 4.0 ·{' '}
        <a href="https://github.com/Nonarkara/luma-house/blob/main/docs/FURNITURE-CATALOGUE.md" target="_blank" rel="noreferrer">credits</a>
      </p>
    </aside>
  )
}
