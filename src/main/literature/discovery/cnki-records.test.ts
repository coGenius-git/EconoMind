import { describe, expect, it } from 'vitest'
import { parseCnkiRecords } from './cnki-records'

const RIS_EXPORT = [
  'RT Journal Article',
  'A1 王伟',
  'A1 李娜',
  'T1 数字金融对企业创新的影响研究',
  'JF 经济研究',
  'YR 2022',
  'IS 05',
  'DO 10.12345/jjyj.2022.05.002',
  'AB 本文研究了数字金融对企业创新的影响。',
  '',
  'RT 学位论文',
  'A1 张明',
  'T1 绿色金融政策效果评估',
  'JF 北京大学',
  'YR 2021',
  'AB 学位论文摘要。',
  ''
].join('\n')

const ENDNOTE_EXPORT = [
  '%0 Journal Article',
  '%A 陈静',
  '%T 绿色金融与企业绩效',
  '%J 金融研究',
  '%D 2021',
  '%R 10.1234/jryj.2021.03.004',
  '%X 摘要内容。',
  '%U https://kns.cnki.net/kcms/detail/detail.aspx?filename=jryj202103004',
  ''
].join('\n')

describe('parseCnkiRecords', () => {
  it('reads standard RIS separators and record boundaries without merging papers', () => {
    const result = parseCnkiRecords(
      'TY  - JOUR\nTI  - First paper\nAU  - Ada Lovelace\nPY  - 2023\nER  -\nTY  - JOUR\nTI  - Second paper\nER  -'
    )
    expect(result.candidates.map((candidate) => candidate.title)).toEqual([
      'First paper',
      'Second paper'
    ])
    expect(result.candidates[0].authors).toEqual(['Ada Lovelace'])
  })
  it('reads a RefWorks/RIS export into candidates with CNKI metadata', () => {
    const result = parseCnkiRecords(RIS_EXPORT)
    expect(result.format).toBe('ris')
    expect(result.errors).toEqual([])
    expect(result.candidates).toHaveLength(2)
    expect(result.candidates[0]).toMatchObject({
      source: 'cnki',
      title: '数字金融对企业创新的影响研究',
      authors: ['王伟', '李娜'],
      year: 2022,
      venue: '经济研究',
      doi: '10.12345/jjyj.2022.05.002',
      documentType: 'article',
      abstract: '本文研究了数字金融对企业创新的影响。'
    })
    expect(result.candidates[0]?.url).toContain('doi.org')
    expect(result.candidates[1]?.documentType).toBe('dissertation')
  })

  it('reads an EndNote export and maps its tags onto the same shape', () => {
    const result = parseCnkiRecords(ENDNOTE_EXPORT)
    expect(result.format).toBe('endnote')
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0]).toMatchObject({
      source: 'cnki',
      title: '绿色金融与企业绩效',
      authors: ['陈静'],
      year: 2021,
      venue: '金融研究',
      doi: '10.1234/jryj.2021.03.004',
      abstract: '摘要内容。'
    })
  })

  it('deduplicates repeated records and keeps the first', () => {
    const duplicated = `${RIS_EXPORT}\n${RIS_EXPORT}`
    expect(parseCnkiRecords(duplicated).candidates).toHaveLength(2)
  })

  it('reports a file that is not a CNKI export', () => {
    const result = parseCnkiRecords('just some prose\nwithout any tags')
    expect(result.candidates).toEqual([])
    expect(result.errors[0]).toContain('not a CNKI export')
  })

  it('skips records without a title instead of dropping the whole file', () => {
    const result = parseCnkiRecords(
      ['RT Journal Article', 'A1 某人', '', 'RT Journal Article', 'T1 有标题', ''].join('\n')
    )
    expect(result.candidates).toHaveLength(1)
    expect(result.errors.join(' ')).toContain('without a title')
  })

  it('keeps a stable key so the same export can be re-imported', () => {
    const first = parseCnkiRecords(RIS_EXPORT)
    const second = parseCnkiRecords(RIS_EXPORT)
    expect(first.candidates[0]?.key).toBe(second.candidates[0]?.key)
  })
})
