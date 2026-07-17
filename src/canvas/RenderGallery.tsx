import React, { useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, Moon, Sofa, Sun } from 'lucide-react'

const renders = [
  { id: 'exterior', title: 'North courtyard', note: 'Morning · 8:15 AM', icon: Sun },
  { id: 'interior', title: 'Living to garden', note: 'Afternoon · 3:40 PM', icon: Sofa },
  { id: 'night', title: 'Lighting scene', note: 'Entertain · 7:30 PM', icon: Moon },
] as const

function ExteriorRender() {
  return (
    <svg className="architectural-render" viewBox="0 0 1200 720" role="img" aria-label="Exterior rendering of Lantern Courtyard house">
      <defs>
        <linearGradient id="ext-sky" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#b8c8c5"/><stop offset="1" stopColor="#ebe5d3"/></linearGradient>
        <linearGradient id="ext-glass" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#557173"/><stop offset="1" stopColor="#17282b"/></linearGradient>
        <filter id="ext-shadow"><feDropShadow dx="0" dy="20" stdDeviation="18" floodOpacity=".28"/></filter>
      </defs>
      <rect width="1200" height="720" fill="url(#ext-sky)"/>
      <circle cx="930" cy="120" r="54" fill="#f3ce70" opacity=".76"/>
      <path d="M0 475 C230 440 370 486 560 458 C770 426 963 456 1200 420 V720 H0Z" fill="#566b4d"/>
      <path d="M0 545 C260 500 490 530 760 496 C960 470 1080 486 1200 475 V720 H0Z" fill="#263d31"/>
      <g filter="url(#ext-shadow)">
        <path d="M185 325 L925 325 L1090 420 L340 420 Z" fill="#292b27"/>
        <path d="M228 349 L908 349 L1004 405 L327 405 Z" fill="#ddd5c2"/>
        <path d="M252 404 L1000 404 L1000 590 L252 590 Z" fill="#c8c0ad"/>
        <rect x="300" y="425" width="290" height="165" fill="url(#ext-glass)"/>
        <rect x="625" y="425" width="175" height="165" fill="url(#ext-glass)"/>
        <rect x="830" y="425" width="128" height="165" fill="#8b5c3b"/>
        {Array.from({length: 9}, (_, index) => <rect key={index} x={838 + index * 13} y="425" width="5" height="165" fill="#513825" opacity=".66"/>)}
        <rect x="590" y="414" width="18" height="185" fill="#393c35"/>
        <rect x="800" y="414" width="18" height="185" fill="#393c35"/>
      </g>
      <path d="M240 591 H1018 L1110 650 H115 L240 591Z" fill="#b9b09d"/>
      <path d="M538 620 C625 580 700 580 788 620 C706 660 620 659 538 620Z" fill="#7fa3a0" opacity=".72"/>
      <g fill="#1c3526"><path d="M120 565 Q170 430 215 563Z"/><path d="M1035 585 Q1085 420 1140 585Z"/></g>
      <g fill="none" stroke="#ece8dc" strokeWidth="3" opacity=".7"><path d="M365 450H525M365 480H525M365 510H525"/></g>
    </svg>
  )
}

function InteriorRender() {
  return (
    <svg className="architectural-render" viewBox="0 0 1200 720" role="img" aria-label="Interior rendering of living room looking into the courtyard">
      <defs>
        <linearGradient id="int-garden" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#b9d2ca"/><stop offset="1" stopColor="#456650"/></linearGradient>
        <linearGradient id="int-floor" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d0c5ad"/><stop offset="1" stopColor="#8f8068"/></linearGradient>
      </defs>
      <rect width="1200" height="720" fill="#d8d0be"/>
      <polygon points="0,0 1200,0 990,185 180,185" fill="#4a453c"/>
      <polygon points="0,720 1200,720 922,432 235,432" fill="url(#int-floor)"/>
      <rect x="250" y="150" width="700" height="330" fill="url(#int-garden)"/>
      <path d="M250 370 Q380 260 490 370 Q610 230 730 370 Q830 280 950 360 V480 H250Z" fill="#335342"/>
      <rect x="230" y="130" width="28" height="380" fill="#272a26"/><rect x="946" y="130" width="28" height="380" fill="#272a26"/>
      <rect x="585" y="130" width="18" height="380" fill="#30332e"/>
      <path d="M0 0H1200V92H0Z" fill="#242521"/>
      <g stroke="#c6b999" strokeWidth="4" opacity=".65"><path d="M60 36H1140"/><path d="M70 54H1130"/></g>
      <g>
        <path d="M160 488 H600 Q636 488 650 527 V650 H115 V540 Q115 488 160 488Z" fill="#ddd6c8"/>
        <rect x="155" y="520" width="210" height="98" rx="18" fill="#bab2a4"/>
        <rect x="380" y="520" width="210" height="98" rx="18" fill="#c5bdaf"/>
        <rect x="185" y="496" width="72" height="54" rx="10" fill="#796d58"/>
      </g>
      <g>
        <ellipse cx="825" cy="585" rx="185" ry="62" fill="#463f34"/>
        <ellipse cx="825" cy="568" rx="185" ry="62" fill="#927454"/>
        <path d="M700 565V680M950 565V680" stroke="#332e28" strokeWidth="14"/>
      </g>
      <g fill="#272924"><rect x="735" y="485" width="12" height="90"/><rect x="905" y="485" width="12" height="90"/></g>
      <g fill="#d6a94a"><circle cx="741" cy="475" r="25" opacity=".8"/><circle cx="911" cy="475" r="25" opacity=".8"/></g>
      <path d="M410 432 L660 432 L770 720 H520Z" fill="#f4d277" opacity=".18"/>
    </svg>
  )
}

function NightRender() {
  return (
    <svg className="architectural-render" viewBox="0 0 1200 720" role="img" aria-label="Night rendering showing architectural lighting channels">
      <defs>
        <linearGradient id="night-sky" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#11152a"/><stop offset="1" stopColor="#272734"/></linearGradient>
        <filter id="night-glow"><feGaussianBlur stdDeviation="18"/></filter>
      </defs>
      <rect width="1200" height="720" fill="url(#night-sky)"/>
      <circle cx="930" cy="112" r="38" fill="#d9dfdc" opacity=".84"/>
      <g fill="#f8c966" opacity=".18" filter="url(#night-glow)"><rect x="235" y="360" width="350" height="230"/><rect x="615" y="360" width="210" height="230"/><ellipse cx="700" cy="624" rx="410" ry="48"/></g>
      <path d="M175 325 L930 325 L1080 410 L330 410 Z" fill="#161815"/>
      <path d="M240 395 H1000 V590 H240Z" fill="#37352f"/>
      <rect x="280" y="420" width="300" height="170" fill="#413b2f"/>
      <rect x="290" y="430" width="280" height="150" fill="#e3a84c" opacity=".52"/>
      <rect x="615" y="420" width="200" height="170" fill="#282b29"/>
      <rect x="625" y="430" width="180" height="150" fill="#f0bb58" opacity=".36"/>
      <rect x="845" y="420" width="115" height="170" fill="#5f4934"/>
      <g stroke="#f1c66d" strokeWidth="6" opacity=".88"><path d="M278 414H582"/><path d="M615 414H817"/><path d="M245 596H996"/></g>
      <g fill="#f4d889"><circle cx="355" cy="485" r="6"/><circle cx="455" cy="485" r="6"/><circle cx="680" cy="485" r="6"/><circle cx="755" cy="485" r="6"/></g>
      <path d="M200 610 C390 580 780 580 1040 616" fill="none" stroke="#eac474" strokeWidth="5" strokeDasharray="5 34"/>
      <path d="M0 610 C260 570 450 650 700 610 C895 580 1040 600 1200 565 V720H0Z" fill="#14251b"/>
      <g fill="#f0cf7b"><circle cx="225" cy="620" r="5"/><circle cx="350" cy="612" r="5"/><circle cx="520" cy="620" r="5"/><circle cx="720" cy="610" r="5"/><circle cx="920" cy="612" r="5"/></g>
    </svg>
  )
}

export const RenderGallery = React.memo(function RenderGallery() {
  const [activeIndex, setActiveIndex] = useState(0)
  const active = renders[activeIndex]
  const ActiveIcon = active.icon

  const move = (direction: number) => {
    setActiveIndex((index) => (index + direction + renders.length) % renders.length)
  }

  return (
    <div className="render-gallery" aria-label="Architectural rendering gallery">
      <div className="render-stage">
        {active.id === 'exterior' ? <ExteriorRender /> : active.id === 'interior' ? <InteriorRender /> : <NightRender />}
        <div className="render-meta">
          <span><ActiveIcon /></span>
          <div><small>Rendering 0{activeIndex + 1}</small><strong>{active.title}</strong><em>{active.note}</em></div>
        </div>
        <div className="render-nav">
          <button type="button" onClick={() => move(-1)} aria-label="Previous rendering"><ChevronLeft /></button>
          <span>{activeIndex + 1} / {renders.length}</span>
          <button type="button" onClick={() => move(1)} aria-label="Next rendering"><ChevronRight /></button>
        </div>
      </div>
      <div className="render-thumbs">
        {renders.map((item, index) => {
          const Icon = item.icon
          return (
            <button key={item.id} type="button" className={index === activeIndex ? 'active' : ''} onClick={() => setActiveIndex(index)}>
              <Icon /><span><strong>{item.title}</strong><small>{item.note}</small></span>
            </button>
          )
        })}
      </div>
      <div className="render-disclaimer"><Camera /> Concept render • material, planting, and lighting intent—not construction documentation</div>
    </div>
  )
})
