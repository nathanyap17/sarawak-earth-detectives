// Office UI state: which window is open, what the pointer is over, whether the student is idle.
// AI-assisted: written with Claude Code.
import { create } from 'zustand'
import type { Beat } from '../state/session'

export type SpotId = Beat | 'inbox' | 'agency'

interface UI {
  win: SpotId | null
  hover: SpotId | null
  idle: boolean
  /** the camera is gliding to or from a station: floating labels hide until it settles */
  moving: boolean
  setMoving: (m: boolean) => void
  inboxSeen: boolean
  setWin: (w: SpotId | null) => void
  setHover: (h: SpotId | null) => void
  setIdle: (i: boolean) => void
  /** the map table's own view while the scene is open: zoom 1 (whole table) to MAX_ZOOM, and a pan
   *  in table metres. It resets whenever the student leaves the scene. */
  mapView: MapView
  setMapView: (v: Partial<Omit<MapView, 'used'>> & { used?: Partial<MapView['used']> }) => void
  resetMapView: () => void
}

export interface MapView { zoom: number; x: number; z: number; used: { zoom: boolean; pan: boolean } }
export const MAX_ZOOM = 4.5
const HOME: MapView = { zoom: 1, x: 0, z: 0, used: { zoom: false, pan: false } }

export const useUI = create<UI>((set) => ({
  win: null, hover: null, idle: false, inboxSeen: false, moving: false, mapView: HOME,
  setMapView: (v) => set((s) => ({ mapView: { ...s.mapView, ...v, used: { ...s.mapView.used, ...v.used } } })),
  resetMapView: () => set((s) => ({ mapView: { ...HOME, used: s.mapView.used } })),
  setMoving: (moving) => set({ moving }),
  setWin: (win) => set((s) => ({ win, hover: null, inboxSeen: s.inboxSeen || win === 'inbox',
    mapView: win === 'scene' ? s.mapView : { ...HOME, used: s.mapView.used } })),
  setHover: (hover) => set({ hover }),
  setIdle: (idle) => set({ idle }),
}))
