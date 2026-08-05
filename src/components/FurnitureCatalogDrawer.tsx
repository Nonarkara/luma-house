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
  { kind: 'wardrobe', label: 'Built-in Wardrobe', category: 'bedroom', dimensions: '2.4 × 0.6 m', icon: LayoutGrid },
  { kind: 'sofa', label: 'Lounge Armchair', category: 'living', dimensions: '0.9 × 0.9 m', icon: Flower2 },
]

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
    <div
      className="furniture-catalog-drawer"
      style={{
        position: 'absolute',
        top: 60,
        left: 20,
        width: 320,
        maxHeight: 'calc(100vh - 120px)',
        zIndex: 50,
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 16,
        boxShadow: '0 25px 40px -10px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#ffffff',
      }}
    >
      {/* Header */}
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers style={{ width: 18, height: 18, color: 'var(--accent-primary, #3b82f6)' }} />
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Furniture Catalog</h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'none', border: 0, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 4 }}
        >
          <X style={{ width: 18, height: 18 }} />
        </button>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 14px', overflowX: 'auto', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCategory(c.id)}
            style={{
              padding: '4px 10px',
              borderRadius: 12,
              border: 0,
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: activeCategory === c.id ? 'var(--accent-primary, #3b82f6)' : 'rgba(255, 255, 255, 0.08)',
              color: activeCategory === c.id ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Item Grid */}
      <div style={{ padding: 12, overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {filteredItems.map((item, idx) => {
          const Icon = item.icon
          return (
            <div
              key={`${item.kind}-${idx}`}
              onClick={() => {
                onAddFurniture(item.kind, item.label)
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 12,
                padding: 10,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 6,
              }}
              className="catalog-card-hover"
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                <Icon style={{ width: 20, height: 20 }} />
              </div>
              <strong style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f8fafc' }}>{item.label}</strong>
              <span style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.5)' }}>{item.dimensions}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
