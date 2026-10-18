/**
 * One invented SVG for each drawing program's way of writing one, and the
 * variants a person commonly makes with the same program: test support for
 * the cleaner, never published (0030).
 *
 * Each is the same invented mark -- a disc, a bar with a two-stop gradient,
 * a chevron stroke, in some a word mark as paths -- written the way each
 * program writes it, from what its export is known to contain: its
 * declaration, comments, namespaces, attribute order, CSS, colour forms,
 * units, ids and metadata. No real file and no real name. They have not
 * been compared with a real export; Canva's clip on every element and its
 * glyphs as `symbol` and `use` in particular are from memory. Written on
 * 2026-10-18 to measure the grammar, whose counts of what is accepted 0030
 * states.
 */
const mark = { disc: 'M40,10c16.57,0,30,13.43,30,30s-13.43,30-30,30S10,56.57,10,40,23.43,10,40,10Z' }

export interface ExporterSample {
  /** The program and the settings it was exported with. */
  readonly exporter: string
  readonly svg: string
}

export const EXPORTER_SAMPLES: { readonly [name: string]: ExporterSample } = {
  'illustrator-save-as': {
    exporter: 'Adobe Illustrator, File > Save As > SVG (SVG 1.1, CSS Properties: Style Elements, outlines)',
    svg: `<?xml version="1.0" encoding="utf-8"?>
<!-- Generator: Adobe Illustrator 28.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
<svg version="1.1" id="Ebene_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
\t viewBox="0 0 200 80" style="enable-background:new 0 0 200 80;" xml:space="preserve">
<style type="text/css">
\t.st0{fill:#1F4E79;}
\t.st1{fill:url(#SVGID_1_);}
\t.st2{fill:none;stroke:#1F4E79;stroke-width:2;stroke-miterlimit:10;}
</style>
<g>
\t<path class="st0" d="${mark.disc}"/>
\t<linearGradient id="SVGID_1_" gradientUnits="userSpaceOnUse" x1="90" y1="40" x2="190" y2="40">
\t\t<stop  offset="0" style="stop-color:#1F4E79"/>
\t\t<stop  offset="1" style="stop-color:#4A90C2"/>
\t</linearGradient>
\t<rect x="90" y="30" class="st1" width="100" height="20"/>
\t<polyline class="st2" points="10,75 40,60 70,75 "/>
</g>
</svg>
`,
  },
  'illustrator-save-as-text': {
    exporter: 'Illustrator Save As, as above, the word mark left as live text',
    svg: `<?xml version="1.0" encoding="utf-8"?>
<!-- Generator: Adobe Illustrator 28.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
<svg version="1.1" id="Ebene_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"
\t viewBox="0 0 200 80" style="enable-background:new 0 0 200 80;" xml:space="preserve">
<style type="text/css">
\t.st0{fill:#1F4E79;}
\t.st3{font-family:'ArialMT';}
\t.st4{font-size:18px;}
</style>
<path class="st0" d="${mark.disc}"/>
<text transform="matrix(1 0 0 1 90 47)" class="st0 st3 st4">Beispiel</text>
</svg>
`,
  },
  'illustrator-save-as-editing': {
    exporter: 'Illustrator Save As with "Preserve Illustrator Editing Capabilities" (entities, switch, foreignObject, i:pgf)',
    svg: `<?xml version="1.0" encoding="utf-8"?>
<!-- Generator: Adobe Illustrator 28.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" [
\t<!ENTITY ns_extend "http://ns.adobe.com/Extensibility/1.0/">
\t<!ENTITY ns_ai "http://ns.adobe.com/AdobeIllustrator/10.0/">
\t<!ENTITY ns_graphs "http://ns.adobe.com/Graphs/1.0/">
\t<!ENTITY ns_vars "http://ns.adobe.com/Variables/1.0/">
\t<!ENTITY ns_imrep "http://ns.adobe.com/ImageReplacement/1.0/">
\t<!ENTITY ns_sfw "http://ns.adobe.com/SaveForWeb/1.0/">
\t<!ENTITY ns_custom "http://ns.adobe.com/GenericCustomNamespace/1.0/">
\t<!ENTITY ns_adobe_xpath "http://ns.adobe.com/XPath/1.0/">
]>
<svg version="1.1" id="Ebene_1" xmlns:x="&ns_extend;" xmlns:i="&ns_ai;" xmlns:graph="&ns_graphs;"
\t xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 200 80"
\t style="enable-background:new 0 0 200 80;" xml:space="preserve">
<switch>
\t<foreignObject requiredExtensions="&ns_ai;" x="0" y="0" width="1" height="1">
\t\t<i:aipgfRef  xlink:href="#adobe_illustrator_pgf">
\t\t</i:aipgfRef>
\t</foreignObject>
\t<g i:extraneous="self">
\t\t<path style="fill:#1F4E79;" d="${mark.disc}"/>
\t</g>
</switch>
<i:aipgf  id="adobe_illustrator_pgf" i:pgfEncoding="zstd/base64" i:pgfVersion="24">
\t<![CDATA[
\tKLUv/QBYbQAAZW5jb2RlZCBpbnZlbnRlZCBkYXRh
\t]]>
</i:aipgf>
</svg>
`,
  },
  'illustrator-cs-entities': {
    exporter: 'Illustrator CS-era Save As: namespaces declared as entities in the internal subset',
    svg: `<?xml version="1.0" encoding="utf-8"?>
<!-- Generator: Adobe Illustrator 12.0.0, SVG Export Plug-In  -->
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd" [
\t<!ENTITY ns_svg "http://www.w3.org/2000/svg">
\t<!ENTITY ns_xlink "http://www.w3.org/1999/xlink">
]>
<svg  version="1.1" xmlns="&ns_svg;" xmlns:xlink="&ns_xlink;" width="200" height="80" viewBox="0 0 200 80" overflow="visible" enable-background="new 0 0 200 80" xml:space="preserve">
<path fill="#1F4E79" d="${mark.disc}"/>
</svg>
`,
  },
  'illustrator-export-as': {
    exporter: 'Adobe Illustrator, File > Export > Export As > SVG (Styling: Internal CSS, Object IDs: Layer Names, Minify off)',
    svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg id="Ebene_1" data-name="Ebene 1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 200 80">
  <defs>
    <style>
      .cls-1 {
        fill: url(#Unbenannter_Verlauf_2);
      }

      .cls-2 {
        fill: none;
        stroke: #1f4e79;
        stroke-miterlimit: 10;
        stroke-width: 2px;
      }

      .cls-3 {
        fill: #1f4e79;
      }
    </style>
    <linearGradient id="Unbenannter_Verlauf_2" data-name="Unbenannter Verlauf 2" x1="90" y1="40" x2="190" y2="40" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#1f4e79"/>
      <stop offset="1" stop-color="#4a90c2"/>
    </linearGradient>
  </defs>
  <path class="cls-3" d="${mark.disc.replace(/\./g, '.')}"/>
  <rect class="cls-1" x="90" y="30" width="100" height="20"/>
  <polyline class="cls-2" points="10 75 40 60 70 75"/>
</svg>
`,
  },
  'inkscape-1': {
    exporter: 'Inkscape 1.3, File > Save As > Inkscape SVG (layer, namedview, a word converted to paths)',
    svg: `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->

<svg
   width="200mm"
   height="80mm"
   viewBox="0 0 200 80"
   version="1.1"
   id="svg1"
   inkscape:version="1.3.2 (091e20e, 2023-11-25)"
   sodipodi:docname="marke-entwürfe.svg"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns:xlink="http://www.w3.org/1999/xlink"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:svg="http://www.w3.org/2000/svg">
  <sodipodi:namedview
     id="namedview1"
     pagecolor="#ffffff"
     bordercolor="#000000"
     borderopacity="0.25"
     inkscape:showpageshadow="2"
     inkscape:pageopacity="0.0"
     inkscape:pagecheckerboard="0"
     inkscape:deskcolor="#d1d1d1"
     inkscape:document-units="mm" />
  <defs
     id="defs1">
    <linearGradient
       id="linearGradient1"
       inkscape:collect="always">
      <stop
         style="stop-color:#1f4e79;stop-opacity:1;"
         offset="0"
         id="stop1" />
      <stop
         style="stop-color:#4a90c2;stop-opacity:1;"
         offset="1"
         id="stop2" />
    </linearGradient>
    <linearGradient
       inkscape:collect="always"
       xlink:href="#linearGradient1"
       id="linearGradient2"
       x1="90"
       y1="40"
       x2="190"
       y2="40"
       gradientUnits="userSpaceOnUse" />
  </defs>
  <g
     inkscape:label="Ebene 1 – Entwürfe"
     inkscape:groupmode="layer"
     id="layer1">
    <circle
       style="fill:#1f4e79;fill-opacity:1;stroke:none;stroke-width:0.264583"
       id="path1"
       cx="40"
       cy="40"
       r="30" />
    <rect
       style="fill:url(#linearGradient2);fill-opacity:1;stroke:none;stroke-width:0.264583"
       id="rect1"
       width="100"
       height="20"
       x="90"
       y="30" />
    <path
       style="fill:none;stroke:#1f4e79;stroke-width:2;stroke-linecap:butt;stroke-linejoin:miter;stroke-dasharray:none;stroke-opacity:1;-inkscape-stroke:none"
       d="m 10,75 30,-15 30,15"
       id="path2"
       sodipodi:nodetypes="ccc" />
    <g
       aria-label="Bsp"
       id="text1"
       style="font-size:10.5833px;line-height:1.25;font-family:sans-serif;-inkscape-font-specification:sans-serif;font-variation-settings:normal;fill:#1f4e79;stroke-width:0.264583">
      <path
         d="m 92,66 h 3 q 2,0 2,2 0,2 -2,2 h -3 z"
         style="font-variation-settings:normal;marker:none"
         id="path3" />
    </g>
  </g>
</svg>
`,
  },
  figma: {
    exporter: 'Figma, Export > SVG (a frame with "Clip content" on, outline text)',
    svg: `<svg width="200" height="80" viewBox="0 0 200 80" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_12_34)">
<circle cx="40" cy="40" r="30" fill="#1F4E79"/>
<rect x="90" y="30" width="100" height="20" fill="url(#paint0_linear_12_34)"/>
<path d="M10 75L40 60L70 75" stroke="#1F4E79" stroke-width="2"/>
</g>
<defs>
<linearGradient id="paint0_linear_12_34" x1="90" y1="40" x2="190" y2="40" gradientUnits="userSpaceOnUse">
<stop stop-color="#1F4E79"/>
<stop offset="1" stop-color="#4A90C2"/>
</linearGradient>
<clipPath id="clip0_12_34">
<rect width="200" height="80" fill="white"/>
</clipPath>
</defs>
</svg>
`,
  },
  'figma-fade': {
    exporter: 'Figma, as above, the bar fading out to transparent and a layer at 80 % opacity',
    svg: `<svg width="200" height="80" viewBox="0 0 200 80" fill="none" xmlns="http://www.w3.org/2000/svg">
<circle cx="40" cy="40" r="30" fill="#1F4E79"/>
<rect x="90" y="30" width="100" height="20" fill="url(#paint0_linear_12_34)"/>
<g opacity="0.8">
<path d="M10 75L40 60L70 75" stroke="#1F4E79" stroke-width="2"/>
</g>
<defs>
<linearGradient id="paint0_linear_12_34" x1="90" y1="40" x2="190" y2="40" gradientUnits="userSpaceOnUse">
<stop stop-color="#1F4E79"/>
<stop offset="1" stop-color="#1F4E79" stop-opacity="0"/>
</linearGradient>
</defs>
</svg>
`,
  },
  affinity: {
    exporter: 'Affinity Designer 2, Export > SVG (preset "SVG (for export)")',
    svg: `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg width="100%" height="100%" viewBox="0 0 200 80" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:1.5;">
    <g id="Marke" transform="matrix(1,0,0,1,-10,-5)">
        <circle cx="50" cy="45" r="30" style="fill:rgb(31,78,121);"/>
        <rect x="100" y="35" width="100" height="20" style="fill:url(#_Linear1);"/>
        <path d="M20,80L50,65L80,80" style="fill:none;stroke:rgb(31,78,121);stroke-width:2px;"/>
        <g id="Wortmarke" serif:id="Wort marke">
            <path d="M102,66L105,66C107,66 107,70 105,70L102,70L102,66Z" style="fill:rgb(31,78,121);fill-rule:nonzero;"/>
        </g>
    </g>
    <defs>
        <linearGradient id="_Linear1" x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="matrix(100,0,0,100,100,45)"><stop offset="0" style="stop-color:rgb(31,78,121);stop-opacity:1"/><stop offset="1" style="stop-color:rgb(74,144,194);stop-opacity:1"/></linearGradient>
    </defs>
</svg>
`,
  },
  sketch: {
    exporter: 'Sketch, Export > SVG (layer names as ids, text outlined)',
    svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg width="200px" height="80px" viewBox="0 0 200 80" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <!-- Generator: Sketch 100 (00000) - https://sketch.com -->
    <title>Marke</title>
    <defs>
        <linearGradient x1="0%" y1="50%" x2="100%" y2="50%" id="linearGradient-1">
            <stop stop-color="#1F4E79" offset="0%"></stop>
            <stop stop-color="#4A90C2" offset="100%"></stop>
        </linearGradient>
    </defs>
    <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <g id="Marke" transform="translate(10.000000, 10.000000)">
            <circle id="Oval" fill="#1F4E79" cx="30" cy="30" r="30"></circle>
            <rect id="Rectangle" fill="url(#linearGradient-1)" x="80" y="20" width="100" height="20"></rect>
            <polyline id="Path" stroke="#1F4E79" stroke-width="2" points="0 65 30 50 60 65"></polyline>
        </g>
    </g>
</svg>
`,
  },
  'sketch-text': {
    exporter: 'Sketch, as above, the word mark left as text',
    svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg width="200px" height="80px" viewBox="0 0 200 80" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <title>Marke</title>
    <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <circle id="Oval" fill="#1F4E79" cx="40" cy="40" r="30"></circle>
        <text id="Beispiel" font-family="Helvetica" font-size="18" font-weight="normal" fill="#1F4E79">
            <tspan x="90" y="47">Beispiel</tspan>
        </text>
    </g>
</svg>
`,
  },
  canva: {
    exporter: 'Canva, Share > Download > SVG (shapes only, no text, no photo)',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" zoomAndPan="magnify" viewBox="0 0 150 59.999998" height="80" preserveAspectRatio="xMidYMid meet" version="1.0"><defs><clipPath id="7a1b2c3d4e"><path d="M 7.5 7.5 L 52.5 7.5 L 52.5 52.5 L 7.5 52.5 Z M 7.5 7.5 " clip-rule="nonzero"/></clipPath><clipPath id="8b2c3d4e5f"><path d="M 67.5 22.5 L 142.5 22.5 L 142.5 37.5 L 67.5 37.5 Z M 67.5 22.5 " clip-rule="nonzero"/></clipPath></defs><rect x="-15" width="180" fill="#ffffff" y="-6" height="71.999998" fill-opacity="1"/><g clip-path="url(#7a1b2c3d4e)"><path fill="#1f4e79" d="M 30 7.5 C 17.574219 7.5 7.5 17.574219 7.5 30 C 7.5 42.425781 17.574219 52.5 30 52.5 C 42.425781 52.5 52.5 42.425781 52.5 30 C 52.5 17.574219 42.425781 7.5 30 7.5 " fill-opacity="1" fill-rule="nonzero"/></g><g clip-path="url(#8b2c3d4e5f)"><path fill="#4a90c2" d="M 67.5 22.5 L 142.5 22.5 L 142.5 37.5 L 67.5 37.5 Z" fill-opacity="1" fill-rule="nonzero"/></g><path stroke-linecap="butt" transform="matrix(0.75, 0, 0, 0.75, 7.5, 45)" fill="none" stroke-linejoin="miter" d="M 0 20 L 40 0 L 80 20 " stroke="#1f4e79" stroke-width="2" stroke-opacity="1" stroke-miterlimit="4"/></svg>
`,
  },
  'canva-text': {
    exporter: 'Canva, as above, with a word in a font: glyphs as symbol and use',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" zoomAndPan="magnify" viewBox="0 0 150 59.999998" height="80" preserveAspectRatio="xMidYMid meet" version="1.0"><defs><g/></defs><path fill="#1f4e79" d="M 30 7.5 C 17.574219 7.5 7.5 17.574219 7.5 30 C 7.5 42.425781 17.574219 52.5 30 52.5 C 42.425781 52.5 52.5 42.425781 52.5 30 C 52.5 17.574219 42.425781 7.5 30 7.5 " fill-opacity="1" fill-rule="nonzero"/><g fill="#1f4e79" fill-opacity="1"><g transform="translate(67.5, 37.5)"><g><path d="M 1.5 0 L 1.5 -10.5 L 5.25 -10.5 C 7.5 -10.5 7.5 0 5.25 0 Z M 1.5 0 "/></g></g></g><defs><symbol overflow="visible" id="glyph-0-0"><path d="M 1.5 0 L 1.5 -10.5 L 5.25 -10.5 Z"/></symbol></defs><g fill="#1f4e79"><use x="75" y="37.5" xlink:href="#glyph-0-0" xlink:type="simple" xlink:actuate="onLoad" xlink:show="embed"/></g></svg>
`,
  },
}
