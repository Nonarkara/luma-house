import { describe, expect, it } from 'vitest'
import { conceptErrorMessage } from './generateConcept'

/**
 * A message a person can read.
 *
 * The concept worker answers with a JSON body, and that body used to be shown
 * to the user verbatim: pressing "Concept photo" put
 * `{"error":"GEMINI_API_KEY is not configured on the worker"}` on the screen.
 * A server's account of itself is not an answer, and it names an environment
 * variable that has no business in a product.
 */
describe('a concept failure is explained, not dumped', () => {
  it('turns the missing-model error into a sentence, without the variable name', () => {
    const message = conceptErrorMessage('{"error":"GEMINI_API_KEY is not configured on the worker"}', 500)
    expect(message).not.toMatch(/GEMINI_API_KEY/)
    expect(message).not.toMatch(/[{}]/)
    expect(message).toMatch(/model/i)
    expect(message.length).toBeGreaterThan(20)
    // A toast is two lines at most. A sentence longer than this is a log line.
    expect(message.length, 'the message has to fit a toast').toBeLessThanOrEqual(80)
  })

  it('never shows a raw JSON body', () => {
    const body = JSON.stringify({ error: 'GEMINI_API_KEY is not configured on the worker' })
    expect(conceptErrorMessage(body, 500)).not.toContain('"error"')
  })

  it('recognises a quota message', () => {
    expect(conceptErrorMessage('{"error":"daily quota reached"}', 429)).toMatch(/busy|quota/i)
  })

  it('recognises a disabled model', () => {
    expect(conceptErrorMessage('{"error":"GEMINI_MODEL is disabled"}', 503)).toMatch(/switched off|not enabled/i)
  })

  it('passes a short plain sentence through', () => {
    expect(conceptErrorMessage('The sky is on fire', 500)).toContain('The sky is on fire')
  })

  it('hides a long or structural body', () => {
    const noisy = JSON.stringify({ error: 'x'.repeat(400) })
    const message = conceptErrorMessage(noisy, 502)
    expect(message).not.toContain('xxxx')
    expect(message).toContain('502')
  })

  it('says something when the server says nothing', () => {
    const message = conceptErrorMessage('', 500)
    expect(message.length).toBeGreaterThan(10)
    expect(message).toContain('500')
  })
})
