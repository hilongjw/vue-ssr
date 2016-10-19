const fs = require('fs')
const path = require('path')
const serialize = require('serialize-javascript')
const uaParser = require('ua-parser-js')

process.env.VUE_ENV = 'server'
const NODE_ENV = process.env.NODE_ENV || 'production'
const isDev = NODE_ENV === 'development'

const createBundleRenderer = require('vue-server-renderer').createBundleRenderer
const DEFAULT_RENDERER_OPTIONS  = {
    cache: require('lru-cache')({
        max: 1000,
        maxAge: 1000 * 60 * 15
    })
}

let VueRenderer = {}
let DEFAULT_APP_HTML = '{{ APP }}'

function parseHTML (template) {
    const i = template.indexOf(DEFAULT_APP_HTML)
    return {
        head: template.slice(0, i),
        tail: template.slice(i + DEFAULT_APP_HTML.length)
    }
}

function getFileName (webpackServer, projectName) {
    return webpackServer.output.filename.replace('[name]', projectName)
}

function initRenderer (webpackServer, projectName, createRenderer) {
    if (VueRenderer[projectName]) {
        return VueRenderer[projectName]
    }

    if (!isDev) {
        const bundlePath = path.join(webpackServer.output.path, getFileName(webpackServer, projectName))
        VueRenderer[projectName] = createRenderer(fs.readFileSync(bundlePath, 'utf-8'))
    } else {
        require('./bundle-loader')(webpackServer, projectName, bundle => {
            VueRenderer[projectName] = createRenderer(bundle)
        })
    }
}

function VueRender ({ projectName, rendererOptions, webpackServer , AppHtml, contextHandler }) {

    const options = Object.assign({}, DEFAULT_RENDERER_OPTIONS, rendererOptions)
    
    if (AppHtml) {
        DEFAULT_APP_HTML = AppHtml
    }
    
    function createRenderer(bundle) {
        return createBundleRenderer(bundle, options)
    }

    return (req, res, template) => {
        const HTML = parseHTML(template)

        const renderer = initRenderer(webpackServer, projectName, createRenderer)

        if (!renderer) {
            return res.end('waiting for compilation... refresh in a moment.')
        }

        let context

        if (contextHandler) {
            context = contextHandler(req)
        } else {
            context = { url: req.url}
        }

        RenderToStream(renderer, context, HTML, res)
    }
}

function RenderToStream (renderer, context, HTML, res) {
    const renderStream = renderer.renderToStream(context)

    let firstChunk = true
    res.write(HTML.head)

    renderStream.on('data', chunk => {
        if (firstChunk) {
            if (context.initialState) {
                res.write(
                    `<script>window.__INITIAL_STATE__=${
                        serialize(context.initialState, { isJSON: true })
                    }</script>`
                )
            }
            firstChunk = false
        }
        res.write(chunk)
    })

    renderStream.on('end', () => {
        res.end(HTML.tail)
    })

    renderStream.on('error', err => {
        console.error(err)
    })
}

module.exports = VueRender