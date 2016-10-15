process.env.VUE_ENV = 'server'

const isDev = NODE_ENV === 'development'

const fs = require('fs')
const path = require('path')
const serialize = require('serialize-javascript')

const createBundleRenderer = require('vue-server-renderer').createBundleRenderer

const DEFAULT_RENDERER_OPTIONS  = {
    cache: require('lru-cache')({
        max: 1000,
        maxAge: 1000 * 60 * 15
    })
}

let renderer = {}
let DEFAULT_APP_HTML = '{{ APP }}'

function getHTML (template) {
    const i = template.indexOf(DEFAULT_APP_HTML)
    return {
        head: template.slice(0, i),
        tail: template.slice(i + DEFAULT_APP_HTML.length)
    }
}

function getFileName (webpackServer, projectName) {
    return webpackServer.output.filename.replace('[name]', projectName)
}

function VueRender ({ projectName, rendererOptions, webpackServer , AppHtml }) {

    const options = Object.assign({}, DEFAULT_RENDERER_OPTIONS, rendererOptions)
    
    if (AppHtml) {
        DEFAULT_APP_HTML = AppHtml
    }
    
    function createRenderer(bundle) {
        return createBundleRenderer(bundle, options)
    }

    return (req, res, template) => {
        const HTML = getHTML(template)

        if (!isDev) {
            const bundlePath = path.join(webpackServer.output.path, getFileName(webpackServer, projectName))
            renderer[projectName] = createRenderer(fs.readFileSync(bundlePath, 'utf-8'))
        } else {
            require('./bundle-loader')(webpackServer, projectName, bundle => {
                renderer[projectName] = createRenderer(bundle)
            })
        }

        if (!renderer[projectName]) {
            return res.end('waiting for compilation... refresh in a moment.')
        }

        const context = { url: req.url }
        const renderStream = renderer[projectName].renderToStream(context)
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
}

module.exports = VueRender