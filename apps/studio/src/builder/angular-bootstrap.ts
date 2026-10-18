import { provideZonelessChangeDetection } from '@angular/core'
import type { ApplicationRef } from '@angular/core'
import { createApplication } from '@angular/platform-browser'
import type { ReportEditor } from '@formancy/report-builder-core'
import { StudioAngularBuilder } from './angular-builder.js'
import { STUDIO_EDITOR, STUDIO_SLOT } from './angular-editor.js'

/**
 * Put the Angular builder in `host`, over `editor`, and return how to take
 * it out again: formancy.ai-data's host page's mount, with the editor where
 * that page has its engine. `lend` is given the element the builder lends
 * the Preview in its middle, and null when it takes it back (0029).
 *
 * One application per mount, because the editor arrives through the
 * injector and an injector's providers are fixed once it exists. Taking it
 * out destroys the application, which destroys the builder, which lets go of
 * the editor (0012); the editor itself is the Studio's, and stays.
 *
 * `createApplication` and `bootstrap(component, element)`, not
 * `bootstrapApplication`, which finds its host by selector -- the first
 * matching element in the document. Zoneless, as the builder's own suites
 * run it.
 */
export async function mountAngularBuilder(host: HTMLElement, editor: ReportEditor, lend: (slot: HTMLElement | null) => void): Promise<() => void> {
  const root = document.createElement('report-studio-builder')
  host.append(root)

  let app: ApplicationRef | undefined
  try {
    app = await createApplication({
      providers: [provideZonelessChangeDetection(), { provide: STUDIO_EDITOR, useValue: editor }, { provide: STUDIO_SLOT, useValue: lend }],
    })
    app.bootstrap(StudioAngularBuilder, root)
  } catch (error) {
    // A failed start leaves nothing behind: no application holding the
    // editor, and no element for the next attempt to mount beside.
    app?.destroy()
    root.remove()
    throw error
  }

  const started = app
  return () => {
    started.destroy()
    root.remove()
  }
}
