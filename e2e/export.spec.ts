import { test, expect, type Page, type TestInfo } from '@playwright/test'
import { build } from 'vite'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Box3 } from 'three'
import { chinaApartmentPlan } from '../src/mockups/chinaApartment'
import { encodePlanToHash } from '../src/sharePlan'
import { houseMesh } from '../src/fabricate/houseMesh'
const require = createRequire(import.meta.url)
// Bundle the existing independent reader for this test only, never into dist.
const reader = build({ configFile: false, logLevel: 'silent', build: { write: false, lib: { entry: require.resolve('three/examples/jsm/loaders/3MFLoader.js'), formats: ['iife'], name: 'ExportReader' } } }).then(result => {
  const output = (Array.isArray(result) ? result[0] : result).output
  const chunk = output.find(item => item.type === 'chunk')!
  if (chunk.type !== 'chunk') throw new Error('Reader bundle missing')
  return chunk.code
})
async function download(page: Page, info: TestInfo, name: string, extension: string) {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name, exact: true }).click()
  const file = await pending
  expect(file.suggestedFilename()).toMatch(new RegExp(`\\.${extension}$`))
  const path = info.outputPath(`model.${extension}`)
  await file.saveAs(path)
  return readFile(path)
}
test('export controls gate thin walls and downloaded GLB/STL/3MF open in independent readers', async ({ page }, info) => {
  const requests: string[] = []
  await page.route('**/luma-concept-render.drnon.workers.dev/**', route => { requests.push(route.request().url()); return route.abort() })
  await page.goto('/#plan=' + encodePlanToHash(chinaApartmentPlan))
  const open = async () => {
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    await page.getByRole('button', { name: 'Scale model', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Take the design out' })).toBeVisible()
  }
  await open()
  const glb = await download(page, info, '.glb', 'glb')
  const gltf = await new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '')
  const extent = new Box3().setFromObject(gltf.scene)
  expect(extent.max.y).toBeCloseTo(houseMesh(chinaApartmentPlan).bounds.maxZ, 3)
  await open()
  await page.getByLabel('Scale', { exact: true }).selectOption('100')
  await page.getByLabel('Thicken walls that are too thin to print', { exact: true }).uncheck()
  await expect(page.getByRole('button', { name: '.stl', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Download .3mf', exact: true })).toBeDisabled()
  await page.getByLabel('Thicken walls that are too thin to print', { exact: true }).check()
  await expect(page.getByText(/not true to scale in wall thickness/)).toBeVisible()
  const stl = await download(page, info, '.stl', 'stl')
  const geometry = new STLLoader().parse(stl.buffer.slice(stl.byteOffset, stl.byteOffset + stl.byteLength))
  geometry.computeBoundingBox()
  expect(geometry.boundingBox!.min.z).toBeCloseTo(0, 5)
  expect(geometry.boundingBox!.max.z).toBeCloseTo(29.5, 3)
  await open()
  const bytes = await download(page, info, 'Download .3mf', '3mf')
  // Keep the independent reader subject to production's script-src policy.
  // Inline injection would fail even though the downloaded export is valid.
  await page.route('**/__designon_export_reader.js', async route => route.fulfill({ contentType: 'application/javascript', body: await reader }))
  await page.addScriptTag({ url: '/__designon_export_reader.js' })
  const result = await page.evaluate(bytes => {
    const parser = (window as unknown as { ExportReader: { ThreeMFLoader: new () => { parse: (bytes: ArrayBuffer) => { traverse: (callback: (object: { geometry?: { attributes: { position: { count: number; array: ArrayLike<number> } }; index?: { count: number } } }) => void) => void } } } }).ExportReader.ThreeMFLoader
    const root = new parser().parse(new Uint8Array(bytes).buffer)
    let triangles = 0, meshes = 0, minZ = Infinity, maxZ = -Infinity
    root.traverse(object => {
      if (!object.geometry) return
      meshes++
      const geometry = object.geometry
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3
      const positions = geometry.attributes.position.array
      for (let i = 2; i < positions.length; i += 3) { minZ = Math.min(minZ, positions[i]); maxZ = Math.max(maxZ, positions[i]) }
    })
    return { triangles, meshes, minZ, maxZ }
  }, [...bytes])
  expect(result.meshes).toBe(2)
  expect(result.triangles).toBeGreaterThan(100)
  expect(result.minZ).toBeCloseTo(0, 5)
  expect(result.maxZ).toBeCloseTo(57, 3)
  expect(requests).toEqual([])
})
test('a plate-edge print is blocked after wall thickening and an empty drawing still exports JSON', async ({ page }) => {
  const oversized = { ...chinaApartmentPlan, site: { w: 50.05, h: 10, unit: 1 }, rooms: [{ id: 'r', name: 'Long room', kind: 'living' as const, x: 0, y: 0, w: 100, h: 100 }], openings: [] }
  await page.goto('/#plan=' + encodePlanToHash(oversized))
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await page.getByRole('button', { name: 'Scale model', exact: true }).click()
  await page.getByLabel('Scale', { exact: true }).selectOption('200')
  await expect(page.getByText(/larger than a 256 mm plate/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download .3mf', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.goto('/#plan=' + encodePlanToHash({ ...chinaApartmentPlan, rooms: [], openings: [], furniture: [] }))
  await page.reload() // share hashes apply on document entry, not a hash-only navigation
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await page.getByRole('button', { name: 'Scale model', exact: true }).click()
  await expect(page.getByRole('button', { name: '.json', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: '.glb', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Download .3mf', exact: true })).toBeDisabled()
})
