import { describe, expect, it } from 'vitest'
import { translate } from './translate'

describe('translate', () => {
  it('keeps English and passes unknown strings through', () => {
    expect(translate('en', 'Draw')).toBe('Draw')
    expect(translate('th', 'designon')).toBe('designon')
  })

  it('translates chrome and numeric stage metrics', () => {
    expect(translate('th', 'Window')).toBe('หน้าต่าง')
    expect(translate('zh', 'Cost')).toBe('造价')
    expect(translate('th', 'No windows yet')).toBe('ยังไม่มีหน้าต่าง')
    expect(translate('zh', '12 m² · 1 room')).toBe('12 平方米 · 1 间')
    expect(translate('th', '4 windows')).toBe('4 หน้าต่าง')
    expect(translate('zh', 'Draw done. Next: Sun')).toBe('绘制完成。下一步：日照')
    expect(translate('th', 'Room 2')).toBe('ห้อง 2')
  })

  it('does not list the English word Draw inside Thai or Chinese chrome', () => {
    expect(translate('th', 'Start from a blank page')).not.toMatch(/Start|blank|page/)
    expect(translate('zh', 'Add exterior door')).not.toMatch(/Add|exterior|door/)
  })

  it('translates sun captions, cost fragments and the section cut', () => {
    expect(translate('th', '12:30 · 47° alt · 199° az')).toBe('12:30 · สูง 47° · ทิศ 199°')
    expect(translate('zh', 'Sunrise 05:59 · Sunset 17:18')).toBe('日出 05:59 · 日落 17:18')
    expect(translate('th', 'm² is the cost anchor')).not.toMatch(/cost|anchor/)
    expect(translate('zh', '3D section cut at 2.4 m — anything above is clipped')).not.toMatch(/section|cut|clipped/)
    expect(translate('th', 'Estimated from')).not.toMatch(/Estimated|from/)
    expect(translate('th', 'Change city · Bangkok')).toBe('เปลี่ยนเมือง · Bangkok')
    expect(translate('zh', 'Bangkok, Thailand · Change city')).toBe('Bangkok, Thailand · 更换城市')
  })
})
