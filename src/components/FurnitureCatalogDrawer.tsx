import React, { useState } from 'react'
import { X, Bed, Armchair, Monitor, Utensils, Flower2, Tv, LayoutGrid, Layers } from 'lucide-react'
import { furnitureCatalog } from '../plan'
import type { FurnitureKind } from '../types'

interface FurnitureCatalogDrawerProps {
  open: boolean
  onClose: () => void
  onAddFurniture: (kind: FurnitureKind, label: string, size?: { wM: number; dM: number }) => void
}

interface CatalogItem {
  kind: FurnitureKind
  label: string
  category: 'bedroom' | 'living' | 'office' | 'dining' | 'decor'
  /** Explicit footprint override. Omitted = the generic kind spec. */
  size?: { wM: number; dM: number }
  icon: typeof Bed
}

const CATALOG_ITEMS: CatalogItem[] = [
  { kind: 'bed', label: 'King Bed & Nightstands', category: 'bedroom', size: { wM: 2.0, dM: 2.0 }, icon: Bed },
  { kind: 'bed', label: 'Single Bed', category: 'bedroom', size: { wM: 1.2, dM: 2.0 }, icon: Bed },
  { kind: 'sofa', label: '3-Seater Living Sofa', category: 'living', size: { wM: 2.4, dM: 0.9 }, icon: Armchair },
  { kind: 'sofa', label: 'L-Shape Sectional', category: 'living', size: { wM: 2.8, dM: 1.8 }, icon: Armchair },
  { kind: 'desk', label: 'Executive Workstation', category: 'office', size: { wM: 1.6, dM: 0.8 }, icon: Monitor },
  { kind: 'dining', label: '6-Person Dining Table', category: 'dining', size: { wM: 1.8, dM: 0.9 }, icon: Utensils },
  { kind: 'sofa', label: 'Media & TV Console', category: 'living', size: { wM: 2.0, dM: 0.4 }, icon: Tv },
  { kind: 'wardrobe', label: 'Built-in Wardrobe', category: 'bedroom', size: { wM: 2.0, dM: 0.6 }, icon: LayoutGrid },
  { kind: 'sofa', label: 'Lounge Armchair', category: 'living', size: { wM: 0.9, dM: 0.9 }, icon: Flower2 },
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
  ]

  const needle = searchQuery.trim().toLowerCase()
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
            const dimensions = `${size.wM.toFixed(1)} × ${size.dM.toFixed(1)} m`
            return (
              <button
                key={`${item.kind}-${idx}`}
                type="button"
                onClick={() => onAddFurniture(item.kind, item.label, item.size)}
                className="catalog-card"
                aria-label={`Add ${item.label}, ${dimensions}`}
              >
                <span className="catalog-card-icon" aria-hidden="true">
                  <Icon className="catalog-card-icon-svg" />
                </span>
                <strong className="catalog-card-name">{item.label}</strong>
                <span className="catalog-card-dim">{dimensions}</span>
              </button>
            )
          })
        )}
      </div>
    </aside>
  )
}
