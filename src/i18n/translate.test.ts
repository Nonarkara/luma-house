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
    expect(translate('th', 'Living')).toBe('นั่งเล่น')
    expect(translate('zh', 'Saved views')).toBe('已存视图')
    expect(translate('th', 'Study sheet')).toBe('แผ่นการศึกษา')
    expect(translate('zh', 'South living room is below the reference room area')).toBe('朝南起居室小于参考房间面积')
    expect(translate('th', 'incl. 15% contingency')).toBe('รวมเผื่อ 15%')
    expect(translate('th', 'Change city · Bangkok')).toBe('เปลี่ยนเมือง · Bangkok')
    expect(translate('zh', 'Bangkok, Thailand · Change city')).toBe('Bangkok, Thailand · 更换城市')
  })

  it('translates plan labels, the currency source and rule names', () => {
    expect(translate('th', 'Living, 27.6 square meters')).toBe('นั่งเล่น 27.6 ตารางเมตร')
    expect(translate('zh', 'Select South living room, 18.0 square meters')).toBe('选择朝南起居室，18.0 平方米')
    expect(translate('th', 'Rooms in this drawing')).toBe('ห้องในภาพนี้')
    expect(translate('zh', 'window opening 1.60 by 1.20 meters')).toBe('窗开口 1.60 乘 1.20 米')
    expect(translate('th', 'door opening 0.90 by 2.10 meters')).toBe('ประตู ช่องเปิด 0.90 คูณ 2.10 เมตร')
    const source = 'Bank of Thailand reference rates for THB, USD and EUR, and ECB via Frankfurter for ZAR and SGD, 15 Oct 2026'
    expect(translate('th', `The authored RMB specification, converted at ${source}. Not a local market rate card.`)).not.toMatch(/reference rates|Not a local/)
    expect(translate('zh', `The authored RMB specification, converted at ${source}. Not a local market rate card.`)).not.toMatch(/reference rates|Not a local/)
    expect(translate('th', source)).toMatch(/ธนาคารแห่งประเทศไทย/)
    expect(translate('zh', source)).toMatch(/泰国银行/)
    expect(translate('th', 'MODEL-EGRESS')).toBe('MODEL-EGRESS')
    expect(translate('zh', 'Modeled route outdoors')).toBe('建模的室外路径')
    expect(translate('th', 'Whole-dwelling ventilation')).toBe('การระบายอากาศทั้งบ้าน')
    expect(translate('zh', 'Info')).toBe('信息')
    expect(translate('th', 'Warning')).toBe('คำเตือน')
  })
})
