import {controller, target, targets} from '@github/catalyst'

@controller
class GitCloneHelpElement extends HTMLElement {
  @target helpField: HTMLInputElement
  @targets helpTexts: HTMLElement[]
  @targets cloneURLButtons: HTMLElement[]

  updateURL(event: Event) {
    const switcher = event.currentTarget as HTMLElement

    const url = switcher.getAttribute('data-url') || ''

    this.helpField.value = url

    if (switcher.matches('.js-git-protocol-clone-url')) {
      for (const el of this.helpTexts) {
        el.textContent = url
      }
    }

    for (const button of this.cloneURLButtons) {
      button.classList.remove('selected')
    }
    switcher.classList.add('selected')
  }
}
