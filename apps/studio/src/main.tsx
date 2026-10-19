import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The workbench first, then formancy.ai's room, released, which sets the
// workbench's --wb-* to the room's colours and must come after it: both
// say :root, and the later wins (0034; scripts/palette.test.mjs). Then the
// builders' stylesheet on them, then the Studio's. Imported from this
// script, not @imported by a stylesheet, so the notices plugin sees the
// packages' stylesheets as modules and lists their licences
// (formancy.ai-data 0046), and so the gate and the pictures, which inline
// studio.css's relative imports and refuse any other, read the Studio's own.
import '@formancy/themes/workbench.css'
import '@formancy/themes/room.css'
import '@formancy/report-builder-core/report-builder.css'
import './studio.css'
// The faces, from this build (0023). fonts.css @imports their stylesheets,
// which are then no modules; the notices plugin lists their packages by the
// font files the build writes from them.
import './styles/fonts.css'
import encoded from 'virtual:formancy-report-starters'
import { studioImages } from './images/image-store.js'
import { decodeStarters } from './starters/codec.js'
import { studioStarters } from './starters/starters.js'
import { Studio } from './studio.js'
import { createWorkspace } from './workspace.js'

const root = document.getElementById('root')
if (root === null) throw new Error('index.html has no #root to render into')

// The page's lifetime is the workspace's, and the images': nothing disposes
// either but closing the tab, and nothing a person adds leaves the page.
const decoded = decodeStarters(encoded)
const listed = studioStarters(decoded.starters)
const images = studioImages(decoded.images)

createRoot(root).render(
  <StrictMode>
    <Studio starters={listed} workspace={createWorkspace(listed, { images: images.store })} images={images.resolve} />
  </StrictMode>,
)
