/*
 * A host's build, as small as it can be and still be one: esbuild, which the
 * Angular CLI's build is made of, bundling for a browser or for Node. For
 * Angular code it links as the bundle is read, as the CLI does: each file
 * with a partial declaration (`ɵɵngDeclare…`) goes through the linker in
 * @angular/compiler-cli, which turns the declarations into definitions and
 * refuses a library published for a newer Angular than the one installed.
 * The CLI drives that linker through OXC by default, and through this same
 * Babel plugin when NG_BUILD_BABEL_LINKER is set.
 *
 *   node build.mjs --platform browser --exports <package> [--link <package>]
 *   node build.mjs --platform node --entry <file> --outfile <file> [--link <package>]
 *
 * `--exports` bundles everything a package exports, as a host's browser
 * build would, and keeps nothing: a Node built-in in its code, or an import
 * that resolves to nothing, fails here. `--entry` bundles a file for Node
 * and writes it, to run. `--link` links, and fails unless that package's
 * own code was among the files linked, so a filter that skipped it cannot
 * pass by linking only Angular's. Any error fails the build. Warnings are
 * not read: esbuild reports none for code under node_modules, which is where
 * all of a builder's code is.
 */
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { build } from 'esbuild'

const { values: options } = parseArgs({
  options: { platform: { type: 'string' }, exports: { type: 'string' }, entry: { type: 'string' }, outfile: { type: 'string' }, link: { type: 'string' } },
})
if (options.platform !== 'browser' && options.platform !== 'node') throw new Error('--platform is browser or node')
if ((options.exports === undefined) === (options.entry === undefined)) throw new Error('one of --exports and --entry')
if ((options.entry === undefined) !== (options.outfile === undefined)) throw new Error('--entry needs --outfile, and only it')

/** Every file the linker changed, by path. */
const linked = []

/**
 * Links each file that holds a partial declaration as esbuild reads it. The
 * Babel is the one compiler-cli depends on, which is the one its plugin is
 * written for; the options are the CLI's.
 */
async function linker() {
  const { needsLinking } = await import('@angular/compiler-cli/linker')
  const { createEs2015LinkerPlugin } = await import('@angular/compiler-cli/linker/babel')
  const babel = await import(pathToFileURL(createRequire(import.meta.resolve('@angular/compiler-cli/linker/babel')).resolve('@babel/core')).href)
  const transformAsync = babel.transformAsync ?? babel.default.transformAsync
  // A library its Angular is too old for is an error the linker throws; what it only logs is printed.
  const logger = { level: 2, debug: () => {}, info: () => {}, warn: console.log, error: console.log }
  // A file system the linker never needs: it reads nothing beyond the source it is given.
  const fileSystem = { exists: () => false, readFile: () => '', resolve: (...paths) => paths.join('/'), dirname: (path) => path.split('/').slice(0, -1).join('/'), relative: (_from, to) => to }
  return {
    name: 'angular-linker',
    setup(bundler) {
      bundler.onLoad({ filter: /\.m?js$/ }, async ({ path }) => {
        // The CLI's own exception: @angular/core and @angular/compiler name the declarations without making any.
        if (/[\\/]@angular[\\/](?:compiler|core)[\\/]/.test(path)) return undefined
        const source = await readFile(path, 'utf8')
        if (!needsLinking(path, source)) return undefined
        const result = await transformAsync(source, {
          filename: path,
          configFile: false,
          babelrc: false,
          browserslistConfigFile: false,
          compact: false,
          sourceMaps: false,
          plugins: [createEs2015LinkerPlugin({ fileSystem, logger, linkerJitMode: false, sourceMapping: false })],
        })
        linked.push(path)
        return { contents: result.code, loader: 'js' }
      })
    },
  }
}

const browser = options.platform === 'browser'
let result
try {
  result = await build({
    ...(options.exports === undefined
      ? { entryPoints: [options.entry], outfile: options.outfile }
      : { stdin: { contents: `export * from ${JSON.stringify(options.exports)}`, resolveDir: process.cwd(), sourcefile: 'host.js', loader: 'js' }, write: false }),
    bundle: true,
    platform: options.platform,
    format: 'esm',
    // A host's production build, which takes React's production code.
    define: browser ? { 'process.env.NODE_ENV': '"production"' } : {},
    plugins: options.link === undefined ? [] : [await linker()],
    metafile: true,
    logLevel: 'silent',
  })
} catch (error) {
  const messages = error.errors ?? [{ text: String(error.message ?? error) }]
  throw new Error(`the ${options.platform} build failed:\n${messages.map(({ text, location }) => `${text}${location ? ` (${location.file}:${String(location.line)})` : ''}`).join('\n')}`)
}
if (options.link !== undefined && !linked.some((path) => path.replaceAll('\\', '/').includes(`/node_modules/${options.link}/`))) {
  throw new Error(`nothing of ${options.link} was linked; linked: ${linked.join(', ') || 'nothing'}`)
}

const bytes = Object.values(result.metafile.outputs).reduce((total, output) => total + output.bytes, 0)
const read = Object.keys(result.metafile.inputs).length
console.log(
  `ok: bundled ${options.exports === undefined ? options.entry : `everything ${options.exports} exports`} for ${browser ? 'a browser' : 'Node'}: ${String(read)} files, ${String(bytes)} bytes${options.link === undefined ? '' : `, ${String(linked.length)} of them linked, ${options.link} among them`}`,
)
