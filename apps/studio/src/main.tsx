import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// The workbench first, the builders' stylesheet on it, then the Studio's,
// whose room sets the workbench's --wb-* variables (styles/room.css).
// Imported from this script, not @imported by a stylesheet, so the notices
// plugin sees both packages' stylesheets as modules and lists their
// licences (formancy.ai-data 0046).
import '@formancy/themes/workbench.css'
import '@formancy/report-builder-core/report-builder.css'
import './studio.css'
import encoded from 'virtual:formancy-report-starters'
import { decodeStarters } from './starters/codec.js'
import { imagesOf, studioStarters } from './starters/starters.js'
import { Studio } from './studio.js'
import { createWorkspace } from './workspace.js'

const root = document.getElementById('root')
if (root === null) throw new Error('index.html has no #root to render into')

// The page's lifetime is the workspace's: nothing disposes it but closing the tab.
const { starters, images } = decodeStarters(encoded)
const listed = studioStarters(starters)

createRoot(root).render(
  <StrictMode>
    <Studio starters={listed} workspace={createWorkspace(listed)} images={imagesOf(images)} />
  </StrictMode>,
)
