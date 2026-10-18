/**
 * The editor the Angular builder renders, as the application's injector
 * hands it over.
 *
 * In a file of its own, beside the component rather than in it, for
 * formancy.ai-data's reason: the Angular compiler's output for a module that
 * declares no component drops its exports, and the component's file is the
 * one the compiler is pointed at.
 */
import { InjectionToken } from '@angular/core'
import type { ReportEditor } from '@formancy/report-builder-core'

export const STUDIO_EDITOR = new InjectionToken<ReportEditor>('the Studio report editor')

/**
 * Where the Angular builder hands the element it lends the Studio's
 * Preview, in its middle while the Preview stands there, and null when it
 * takes the element back: React draws the Preview into it (0029).
 */
export const STUDIO_SLOT = new InjectionToken<(slot: HTMLElement | null) => void>('the Studio Preview slot')
