import { describe, expect, it } from 'vitest'
import { agentFor, webSearchTrigger, withoutSearchCommand } from './actions'

describe('AI editor actions', () => {
  it('tells action and title from the instruction as HAWKI does', () => {
    expect(agentFor('als übersichtliche Tabelle darstellen')).toEqual({
      action: 'table',
      title: { key: 'table' }
    })
    expect(agentFor('in Stichpunkten / Hauptpunkten zusammenfassen')).toEqual({
      action: 'key_points',
      title: { key: 'key_points' }
    })
    expect(agentFor('deutlich kürzen und auf das Wesentliche reduzieren').action).toBe('shorten')
    expect(agentFor('Formuliere freundlich')).toEqual({
      action: 'rephrase',
      title: { key: 'friendly' }
    })
    expect(agentFor('Mach es besser')).toEqual({
      action: 'rephrase',
      title: { text: 'Mach es besser' }
    })
    expect(agentFor('Schreibe den Text bitte deutlich eleganter').title).toEqual({
      key: 'rephrase'
    })
  })

  it('shows the web search for a link or "/suche" and drops the command', () => {
    expect(webSearchTrigger('/suche aktuelle Informationen')).toEqual({
      shown: true,
      command: true
    })
    expect(webSearchTrigger('Fasse https://www.uni-giessen.de zusammen')).toEqual({
      shown: true,
      command: false
    })
    expect(webSearchTrigger('Schreibe einen Satz')).toEqual({ shown: false, command: false })
    expect(withoutSearchCommand('/suche aktuelle Informationen')).toBe('aktuelle Informationen')
    expect(withoutSearchCommand('Ohne Befehl')).toBe('Ohne Befehl')
  })
})
