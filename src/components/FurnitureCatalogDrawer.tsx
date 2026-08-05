import React, { useState } from 'react'
import { X, Bed, Armchair, Monitor, Utensils, Flower2, Tv, LayoutGrid, Layers } from 'lucide-react'
import type { FurnitureKind } from '../types'

interface FurnitureCatalogDrawerProps {
  open: boolean
  onClose: () => void
  onAddFurniture: (kind: FurnitureKind, label: string) => void
}

interface CatalogItem {
  kind: FurnitureKind
  label: string
  category: 'bedroom' | 'living' | 'office' | 'dining' | 'decor'
  dimensions: string
  icon: typeof Bed
}

const CATALOG_ITEMS: CatalogItem[] = [
  { kind: 'bed', label: 'King Bed & Nightstands', category: 'bedroom', dimensions: '2.0 × 2.0 m', icon: Bed },
  { kind: 'bed', label: 'Single Bed', category: 'bedroom', dimensions: '1.2 × 2.0 m', icon: Bed },
  { kind: 'sofa', label: '3-Seater Living Sofa', category: 'living', dimensions: '2.4 × 0.9 m', icon: Armchair },
  { kind: 'sofa', label: 'L-Shape Sectional', category: 'living', dimensions: '2.8 × 1.8 m', icon: Armchair },
  { kind: 'desk', label: 'Executive Workstation', category: 'office', dimensions: '1.6 × 0.8 m', icon: Monitor },
  { kind: 'dining', label: '6-Person Dining Table', category: 'dining', dimensions: '1.8 × 0.9 m', icon: Utensils },
  { kind: 'sofa', label: 'Media & TV Console', category: 'living', dimensions: '2.0 × 0.4 m', icon: Tv },
  { kind: 'wardrobe', label: 'Built-in Wardrobe', category: 'bedroom', dimensions: '2.0 × 0.6 m', icon: LayoutGrid },
  { kind: 'sofa', label: 'Lounge Armchair', category: 'living', dimensions: '0.9 × 0.9 m', icon: Flower2 },
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

  if (!open) return null

  const categories = [
    { id: 'all', label: 'All Items' },
    { id: 'bedroom', label: 'Bedroom' },
    { id: 'living', label: 'Living' },
    { id: 'office', label: 'Office' },
    { id: 'dining', label: 'Dining' },
  ]

  const filteredItems = activeCategory === 'all' ? CATALOG_ITEMS : CATALOG_ITEMS.filter((i) => i.category === activeCategory)

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
        {filteredItems.map((item, idx) => {
          const Icon = item.icon
          return (
            <button
              key={`${item.kind}-${idx}`}
              type="button"
              onClick={() => onAddFurniture(item.kind, item.label)}
              className="catalog-card"
              aria-label={`Add ${item.label}, ${item.dimensions}`}
            >
              <span className="catalog-card-icon" aria-hidden="true">
                <Icon className="catalog-card-icon-svg" />
              </span>
              <strong className="catalog-card-name">{item.label}</strong>
              <span className="catalog-card-dim">{item.dimensions}</span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
