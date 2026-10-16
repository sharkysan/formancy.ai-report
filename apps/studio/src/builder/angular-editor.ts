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
