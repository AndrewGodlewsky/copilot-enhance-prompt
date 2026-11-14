import { test, assert, mockHost, mount } from '#testing'
import { set } from '#panel'
import { colorTheme, toggleTheme } from './panel/appearance.ts'
import { followTheme } from '../web/src/theme.ts'

test('one theme controller applies stored choices, follows the system, and disposes its listeners', async () => {
  const panel = await mount({ setup: () => {} }, { host: mockHost({ storage: { colorTheme: 'light' } }) })
  const media = Object.assign(new EventTarget(), { matches: true })
  const classes = new Set<string>()
  const root = { classList: { toggle(name: string, on: boolean) { if (on) classes.add(name); else classes.delete(name) } }, style: { colorScheme: '' } }
  const stop = followTheme(media as MediaQueryList, root as unknown as HTMLElement)
  assert.equal(root.style.colorScheme, 'light')
  assert.equal(classes.has('dark'), false)
  toggleTheme()
  assert.equal(classes.has('dark'), true)
  media.matches = false
  media.dispatchEvent(new Event('change'))
  assert.equal(root.style.colorScheme, 'dark')
  set(colorTheme, 'system')
  assert.equal(root.style.colorScheme, 'light')
  media.matches = true
  media.dispatchEvent(new Event('change'))
  assert.equal(root.style.colorScheme, 'dark')
  stop()
  toggleTheme()
  assert.equal(root.style.colorScheme, 'dark', 'disposed subscription no longer changes the document')
  media.matches = false
  media.dispatchEvent(new Event('change'))
  assert.equal(root.style.colorScheme, 'dark')
  await panel.unmount()
})
