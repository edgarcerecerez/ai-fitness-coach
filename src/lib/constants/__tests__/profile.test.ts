import {
  GENDER_OPTIONS,
  ACTIVITY_LEVELS,
  FITNESS_GOALS,
  DIETARY_PREFERENCES,
} from '../profile'

describe('Profile Constants', () => {
  it('exports gender options', () => {
    expect(GENDER_OPTIONS).toHaveLength(4)
    expect(GENDER_OPTIONS[0]).toHaveProperty('value')
    expect(GENDER_OPTIONS[0]).toHaveProperty('label')
  })

  it('exports activity levels', () => {
    expect(ACTIVITY_LEVELS).toHaveLength(5)
    expect(ACTIVITY_LEVELS[0].value).toBe('sedentary')
  })

  it('exports fitness goals', () => {
    expect(FITNESS_GOALS).toContain('Lose weight')
    expect(FITNESS_GOALS).toContain('Gain muscle')
  })

  it('exports dietary preferences', () => {
    expect(DIETARY_PREFERENCES).toHaveLength(8)
    expect(DIETARY_PREFERENCES[0].value).toBe('none')
  })
})