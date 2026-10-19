/**
 * The file input Add image… opens (0033): hidden, outside the
 * accessibility tree, never given focus, taking what the editor says the
 * host keeps. The palette draws Add image… beside it and calls `open`.
 *
 * `open` sends `chooseImage` and, when the editor will take a file now,
 * calls the input's `click()` at once, in the same activation -- a click,
 * Enter or Space -- which opens the platform's chooser; awaiting anything
 * first would lose the activation, and the browser would open nothing.
 *
 * On the input's change the file is taken into a local before `value` is
 * cleared, because in a browser clearing it empties `files`; it is cleared
 * so that the same file chosen again is a change again. A chooser closed
 * without a file changes nothing, and nothing is sent. What the file is,
 * and whether it is added, is the editor's to say, in the live region.
 */
import { Directive, ElementRef, inject } from '@angular/core'
import { ReportEditorRoot } from './root'

@Directive({
  selector: 'input[reportImageChooser]',
  exportAs: 'reportImageChooser',
  host: {
    type: 'file',
    hidden: '',
    '[accept]': 'root.state().images.accept',
    '(change)': 'take()',
  },
})
export class ReportImageChooser {
  protected readonly root = inject(ReportEditorRoot)
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef)

  /** Add image… pressed: the chooser opened, or the live region saying why not. */
  open(): void {
    if (this.root.dispatch({ type: 'chooseImage' }).ok) this.input.nativeElement.click()
  }

  protected take(): void {
    const input = this.input.nativeElement
    const file = input.files?.[0]
    input.value = ''
    if (file !== undefined) void this.root.editor().addImage(file)
  }
}
