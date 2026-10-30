/**
 * The editor's views: what a builder shows of the report, and nothing that
 * edits it -- the pane a narrow layout shows, the side panes hidden for the
 * room, a view of the host's own standing in the design view's place or
 * beside the builder, and the design view's zoom, which is the design
 * view's alone (0019, 0029). None of it reaches the report, its history or
 * another editor over the same session.
 */
import { clampZoom, zoomedIn, zoomedOut } from './geometry.js'
import { EDITOR_PANELS, HIDEABLE_PANELS, HOST_VIEW_PLACES } from './model.js'
import { DONE } from './model-actions.js'
import type { EditorPanel, HideablePanel, HostView, HostViewPlace } from './model.js'
import type { EditorOutcome, EditorRefusalCode } from './model-actions.js'
import { viewOf } from './state.js'
import type { Local } from './state.js'
import { formatZoom } from './text.js'
import type { EditorLocale, EditorText } from './text.js'

/**
 * A view of the host's own the editor makes room for -- the Studio's PDF
 * preview -- by its name: hidden, and in the design view's place, unless
 * it says otherwise.
 */
export interface HostViewOptions {
  readonly name: string
  readonly shown?: boolean
  readonly place?: HostViewPlace
}

/** Each pane that can be hidden, by the message that names it: the diagnostics are the problems. */
const PANE_NAMES = { outline: 'pane.outline', properties: 'pane.properties', diagnostics: 'pane.problems' } as const satisfies Record<HideablePanel, string>

/**
 * The host's view as the editor keeps it: a copy of the option, never the
 * host's own object, which the frozen state would freeze. A view with no
 * name, or in a place nobody knows, is the host's mistake, refused when it
 * is made rather than drawn as a nameless region later.
 */
export function hostViewOf(option: HostViewOptions | undefined): HostView | null {
  if (option === undefined) return null
  if (typeof option.name !== 'string' || option.name.trim() === '')
    throw new RangeError('A host’s view needs a name: a builder names the region it draws the view in by it.')
  const place = option.place ?? 'middle'
  if (!(HOST_VIEW_PLACES as readonly string[]).includes(place))
    throw new RangeError(`A host’s view stands in one of ${HOST_VIEW_PLACES.join(', ')}, not ${String(place)}.`)
  return { name: option.name, shown: option.shown === true, place }
}

/** `host` with `next` in it: the same object when nothing changes, so a host that reads the view alone draws nothing again. */
function hostAs(host: HostView, next: Partial<HostView>): HostView {
  const merged = { ...host, ...next }
  return merged.shown === host.shown && merged.place === host.place ? host : merged
}

/** What the editor lends its view actions: its own state, and its one way each of announcing and refusing. */
export interface ViewEditing {
  local(): Local
  readonly setLocal: (next: Partial<Local>) => void
  readonly announce: (text: string) => Partial<Local>
  readonly refuse: (code: EditorRefusalCode, text: string) => EditorOutcome
}

/** The editor's view actions over `editing`, in the words of `t` and the numbers of `locale`. */
export function viewActions(editing: ViewEditing, t: EditorText, locale: EditorLocale) {
  const { setLocal, announce, refuse } = editing

  /** A pane's name, as its tool in the toolbar says it. */
  function paneName(panel: HideablePanel): string {
    return t(PANE_NAMES[panel])
  }

  /** The host's view, or the refusal for an editor made without one. */
  function withHostView(act: (host: HostView) => EditorOutcome): EditorOutcome {
    const host = editing.local().host
    return host === null ? refuse('unavailable', t('status.noHostView')) : act(host)
  }

  /**
   * Shows the host's view. In the middle it takes the design view's place,
   * and is the pane a narrow layout shows -- which is also how a view shown
   * already comes back into sight there, from another pane. Either way what
   * is in front of the person changed, so the live region says how to bring
   * the design view back; asked again of a view that is the pane shown
   * already, nothing changes and nothing is said.
   */
  function showHostView(host: HostView): EditorOutcome {
    const next = hostAs(host, { shown: true })
    if (viewOf(next) !== 'host') setLocal({ host: next })
    else if (next !== host || editing.local().panel !== 'canvas')
      setLocal({ host: next, panel: 'canvas', ...announce(t('status.hostViewShown', { view: host.name, pane: t('pane.canvas') })) })
    return DONE
  }

  function zoom(to: number): EditorOutcome {
    const { host } = editing.local()
    // The zoom is the design view's: with the host's view in its place it would change what nobody sees.
    if (host !== null && viewOf(host) === 'host') return refuse('unavailable', t('status.zoomHidden', { view: host.name, pane: t('pane.canvas') }))
    if (!Number.isFinite(to)) return refuse('invalid-value', t('input.number'))
    const next = clampZoom(to)
    setLocal({ zoom: next, ...announce(t('status.zoom', { zoom: formatZoom(next, locale) })) })
    return DONE
  }

  return {
    zoom,
    zoomIn: () => zoom(zoomedIn(editing.local().zoom)),
    zoomOut: () => zoom(zoomedOut(editing.local().zoom)),
    openPanel(panel: EditorPanel): EditorOutcome {
      if (!(EDITOR_PANELS as readonly string[]).includes(panel)) return refuse('invalid-value', t('input.option'))
      const local = editing.local()
      const shown = local.hidden.filter((each) => each !== panel)
      // The design view takes its place back from a host's view standing in it; one beside the builder stays.
      const back = panel === 'canvas' && local.host !== null && viewOf(local.host) === 'host' ? { host: hostAs(local.host, { shown: false }) } : {}
      setLocal({ panel, ...(shown.length === local.hidden.length ? {} : { hidden: shown }), ...back })
      return DONE
    },
    hidePanel(panel: HideablePanel): EditorOutcome {
      if (!(HIDEABLE_PANELS as readonly string[]).includes(panel)) return refuse('invalid-value', t('input.option'))
      const local = editing.local()
      if (local.hidden.includes(panel)) return DONE
      const hidden = HIDEABLE_PANELS.filter((each) => each === panel || local.hidden.includes(each))
      // The pane a narrow layout shows is never one that is hidden.
      setLocal({ hidden, ...(local.panel === panel ? { panel: 'canvas' } : {}), ...announce(t('status.paneHidden', { pane: paneName(panel) })) })
      return DONE
    },
    showHostView: () => withHostView(showHostView),
    // The host's own control says it, by its pressed state: the editor adds no sentence.
    hideHostView: () =>
      withHostView((host) => {
        setLocal({ host: hostAs(host, { shown: false }) })
        return DONE
      }),
    placeHostView: (place: HostViewPlace) =>
      withHostView((host) => {
        if (!(HOST_VIEW_PLACES as readonly string[]).includes(place)) return refuse('invalid-value', t('input.option'))
        setLocal({ host: hostAs(host, { place }) })
        return DONE
      }),
  }
}
