import type { ProjectLocation } from '../types'
import type { RoofStyle } from '../canvas/roofGeometry'
export type DisplayStyle = 'architectural' | 'wireframe' | 'solid'
export type DrawingPreset = 'orbit' | 'axonometric' | 'topdown'
export interface StudyCamera {
  projection: 'perspective' | 'orthographic'
  position: [number, number, number]
  target: [number, number, number]
  up: [number, number, number]
  zoom: number
  fov: number
  fieldHeight: number
}
export interface StudySettings {
  preset: DrawingPreset
  style: DisplayStyle
  sectionHeight: number
  roofStyle: RoofStyle
  showRoof: boolean
  shadows: boolean
  sunRays: boolean
  airPaths: boolean
}
export interface StudyScene {
  id: string
  name: string
  capturedAt: string
  geometryKey: string
  location: ProjectLocation
  year: number
  day: number
  hour: number
  camera: StudyCamera
  settings: StudySettings
}
export interface StudyCapture { camera: StudyCamera; image: string }
