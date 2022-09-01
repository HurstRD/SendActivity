import './github/command-palette/mode-observer'
import './github/command-palette/command-palette-mode-element'
import './github/command-palette/command-palette-tip-element'
import './github/command-palette/command-palette-scope-element'
import './github/command-palette/command-palette-token-element'
import './github/command-palette/command-palette-item-group-element'
import './github/command-palette/provider-element'
import './github/command-palette/client-defined-provider-element'
import './github/command-palette/server-defined-provider-element'
import './github/command-palette/command-palette-help-element'
import './github/command-palette/items/server-defined-item'
import './github/command-palette/items/command-item'
import './github/command-palette/items/copyable-item'
import './github/command-palette/items/jump-to-item'
import './github/command-palette/items/jump-to-org-item'
import './github/command-palette/items/jump-to-team-item'
import './github/command-palette/items/search-link-item'
import './github/command-palette/items/access-policy-item'
import './github/command-palette/items/help-item'
import './github/command-palette/providers/server-defined-provider'
import './github/command-palette/providers/server-defined-provider-factory'
import './github/command-palette/providers/files-provider'
import './github/command-palette/providers/prefetched-provider'
import './github/command-palette/providers/search-links-provider'
import './github/command-palette/providers/main-window-commands-provider'
import './github/command-palette/providers/remote-provider'
import './github/command-palette/providers/help-provider'
import CommandPalette from './github/command-palette/command-palette-element'
import {CommandPaletteInputElement} from './github/command-palette/command-palette-input-element'
import {eventToHotkeyString} from '@github/hotkey'
import {fromEvent} from './github/subscription'
import {getCodeEditor} from './github/code-editor'
// eslint-disable-next-line no-restricted-imports
import {observe} from 'selector-observer'
import {sendStats} from './github/stats'

if (!window.customElements.get(CommandPalette.tagName)) {
  // eslint-disable-next-line custom-elements/valid-tag-name, custom-elements/tag-name-matches-class
  window.customElements.define(CommandPalette.tagName, CommandPalette)
}

/**
 * Determines if the command palette exists. If so, attaches event listeners.
 * Otherwise, does nothing.
 *
 * Event listeners attached:
 * - 'toggle' on the command palette <details>
 * - 'keydown' on the document
 * - 'socket:message' on all '.js-socket-channel.js-updatable-content'
 */
function observeCommandPalette() {
  document.addEventListener('keydown', handleKeyDown)

  observe('.js-activate-command-palette', button => {
    button.addEventListener('click', () => {
      document.querySelector('.js-command-palette-dialog')?.setAttribute('open', 'true')
    })
  })

  observe('.js-command-palette-dialog', details => {
    if (!details) return

    const timerStart = window.performance.now()

    const commandPalette = findCommandPalette()
    if (!commandPalette) return

    details.addEventListener('toggle', () => {
      if ((details as HTMLDetailsElement).open) {
        commandPalette.activate()
      } else {
        commandPalette.deactivate()
      }
    })

    commandPalette.addEventListener('command-palette-activated', event => {
      if (!(event instanceof CustomEvent)) return
      if (event.detail.previouslyActivated) return

      sendStats({
        distributionKey: 'COMMAND_PALETTE_FIRST_OPEN',
        distributionValue: window.performance.now() - timerStart
      })
    })
  })

  // Listen to live events, so that we can clear command caches.
  observe('.js-socket-channel.js-updatable-content', {
    subscribe: el =>
      fromEvent(el, 'socket:message', () => {
        const commandPalette = findCommandPalette()
        if (!commandPalette) return

        commandPalette.clearCommands(false)
      })
  })
}

/**
 * Finds the command palette on the page.
 * @returns the command palette if it's present, or null when it's not.
 *
 */
function findCommandPalette(): CommandPalette | null {
  return document.querySelector<CommandPalette>(CommandPalette.tagName)
}

/**
 * Handles site-wide keyboard shortcuts for the command palette.
 * Expects either of the following keydown events:
 * - `platform-meta` + `k`: Opens the command palette.
 * - `platform-meta` + `shift` + `k`: Opens the command palette in command mode.
 * - `platform-meta` + `alt/opt` + `k`:
 *   - When triggered from inside a markdown form, opens the command palette.
 *   - When triggered from outside a markdown form, no ops.
 *
 * @param event
 * @returns void
 */
function handleKeyDown(event: KeyboardEvent): void {
  if (!event.code) return

  const commandPalette = findCommandPalette()
  if (!commandPalette) return

  const onMemexPage = triggeredInsideMemex()
  const isPrimaryActivation = hotkeyMatchesEvent(commandPalette.platformActivationHotkey, event)
  const isSecondaryActivation = hotkeyMatchesEvent(commandPalette.platformSecondaryActivationHotkey, event)
  const isCommandMode = hotkeyMatchesEvent(commandPalette.platformCommandModeHotkey, event)

  // Activate the command palette if:
  // - The user is not in a textarea or Markdown code editor and pressed an activation hotkey OR
  // - The user is not on a Memex page (Memex has its own command palette right now) OR
  // - The user pressed the secondary activation hotkey (which works everywhere) OR
  // - The user has the `command_palette_on_memex` feature flag and pressed the activation hotkey/secondary hotkey/command mode hotkey
  const validPrimaryActivation =
    !shouldIgnoreActivation(event) && !onMemexPage && (isPrimaryActivation || isCommandMode)

  const validSecondaryActivation = !onMemexPage && (isSecondaryActivation || isCommandMode)

  const validMemexActivation =
    commandPalette.hasAttribute('memex-hotkey-enabled') &&
    onMemexPage &&
    (isPrimaryActivation || isSecondaryActivation || isCommandMode)

  if (validPrimaryActivation || validSecondaryActivation || validMemexActivation) {
    toggleCommandPalette(isCommandMode)
    event.preventDefault()
    event.stopPropagation()
  }
}

/**
 * Compares a known hotkey to a KeyboardEvent
 * @param hotkey
 * @param event
 * @returns boolean - whether any parts of the known hotkey string match the KeyboardEvent's hotkey string
 */
function hotkeyMatchesEvent(hotkey: string, event: KeyboardEvent): boolean {
  let hotkeyString = eventToHotkeyString(event)

  // There are cases where a browser can fire a keydown event that looks like
  // a control event but has ctrlKey set to false. This causes hotkeyString to
  // be an empty string. If both values are empty we'll toggle improperly.
  if (!hotkeyString || !hotkey) return false

  // Mac platforms produce a ˚ character when Opt+K is pressed.
  // We need to translate this to match our configured hotkeys.
  hotkeyString = hotkeyString.replace('˚', 'k')

  // multiple hotkeys can be declared with a comma separating them
  // consider it a match if any of the segments matches the event hotkey string.
  return hotkey.split(',').some(h => hotkeyString === h)
}

/**
 * Returns true when we should ignore activation because it is being used by a markdown form.
 * TODO: Update this to only apply to non-default (cmd+k) hotkeys.
 */
function shouldIgnoreActivation(event: KeyboardEvent) {
  return triggeredInsideAPreviewableCommentForm(event) || triggeredInsideAMarkdownCodeEditor(event)
}

/**
 * Checks if an event occurred within a previewable-comment-form.
 *
 * @param event
 * @returns boolean - whether the event was triggered from within a previewable-comment-form.
 */
function triggeredInsideAPreviewableCommentForm(event: KeyboardEvent): boolean {
  const inputTarget = event.target as HTMLInputElement

  if (!inputTarget) return false

  if (inputTarget.closest('.js-previewable-comment-form') !== null) return true

  return false
}

/**
 * Checks if an event occurred within a codeEditor in markdown editing mode.
 *
 * @param event
 * @returns boolean - whether the event was triggered from within a codeEditor in markdown editing mode.
 */
function triggeredInsideAMarkdownCodeEditor(event: KeyboardEvent): boolean {
  const inputTarget = event.target as HTMLInputElement
  if (!inputTarget) return false

  const codeEditorElement = inputTarget.closest<HTMLTextAreaElement>('.js-code-editor')
  if (!codeEditorElement) return false

  const codeEditor = getCodeEditor(codeEditorElement)
  if (!codeEditor) return false

  const editor = codeEditor.editor
  if (!editor) return false

  const mode = editor.getMode().name
  return mode === 'gfm' || mode === 'markdown'
}

/**
 * Checks if an event occurred within a memex.
 *
 * @param event
 * @returns boolean - whether the event was triggered from within a memex.
 */
function triggeredInsideMemex(): boolean {
  const memexRoot = document.querySelector<HTMLElement>('#memex-root')

  if (!memexRoot) return false

  return true
}

/**
 * Toggles the command palette. The command palette can be toggled on when closed, and off when open.
 * You can also toggle bewteen the modeless command palette and the command mode.
 *
 * @param enableCommandMode – set to true to open in command mode
 * @returns void
 */
function toggleCommandPalette(enableCommandMode: boolean): void {
  for (const details of document.querySelectorAll<HTMLDetailsElement>('.js-command-palette-dialog')) {
    const commandPaletteInput = details.querySelector<CommandPaletteInputElement>(CommandPaletteInputElement.tagName)

    if (!commandPaletteInput) return

    if (details.open) {
      details.open = false
    } else {
      toggleCommandMode(commandPaletteInput, enableCommandMode)

      const commandPalette = details.querySelector<CommandPalette>(CommandPalette.tagName)

      if (commandPalette) {
        commandPalette.previouslyActiveElement = document.activeElement as HTMLElement
      }

      details.open = true
    }
  }
}

/**
 * Toggles the command palette bewteen the modeless command palette and the command mode
 *
 * @param commandPaletteInput – the command palette input element
 * @param enableCommandMode – set to true to open in command mode
 * @returns boolean - whether the mode command mode was toggled on or off
 */
function toggleCommandMode(commandPaletteInput: CommandPaletteInputElement, enableCommandMode: boolean): boolean {
  const commandModeActive = commandPaletteInput.inputValue.startsWith('>')

  if (enableCommandMode && !commandModeActive) {
    commandPaletteInput.inputValue = `>${commandPaletteInput.inputValue}`
    return true
  } else if (!enableCommandMode && commandModeActive) {
    commandPaletteInput.inputValue = commandPaletteInput.inputValue.substring(1)
    return true
  } else {
    return false
  }
}

// register on initial page load
observeCommandPalette()
