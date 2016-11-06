const fs = require('fs')
const path = require('path')
const serialize = require('serialize-javascript')

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

const DEFAULT_APP_HTML = '{{ APP }}'

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

class VueSSR {
    constructor ({ projectName, rendererOptions, webpackServer , AppHtml, contextHandler }) {
        this.projectName = projectName
        this.rendererOptions = Object.assign({}, DEFAULT_RENDERER_OPTIONS, rendererOptions)
        this.webpackServerConfig = webpackServer
        this.AppHtml = AppHtml || DEFAULT_APP_HTML
        this.contextHandler = contextHandler
        this.HTML = null
        this.template = ''
        this.initRenderer()
    }

    createRenderer (bundle) {
        return createBundleRenderer(bundle, this.rendererOptions)
    }

    initRenderer () {
        if (this.renderer) {
            return this.renderer
        }

        if (!isDev) {
            const bundlePath = path.join(this.webpackServerConfig.output.path, getFileName(this.webpackServerConfig, this.projectName))
            this.renderer = this.createRenderer(fs.readFileSync(bundlePath, 'utf-8'))
        } else {
            require('./bundle-loader')(this.webpackServerConfig, this.projectName, bundle => {
                this.renderer = this.createRenderer(bundle)
            })
        }
    }

    render (req, res, template) {
        if (this.template !== template) {
            this.HTML = parseHTML(template)
        }
        
        if (!this.renderer) {
            return res.end('waiting for compilation... refresh in a moment.')
        }

        let context = { url: req.url}

        if (this.contextHandler) {
            context = this.contextHandler(req)
        }

        this.RenderToStream(context, res)
    }

    RenderToStream (context, res) {
        const renderStream = this.renderer.renderToStream(context)
        let firstChunk = true

        res.write(this.HTML.head)
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
            res.end(this.HTML.tail)
        })

        renderStream.on('error', err => {
            console.error(err)
        })
    }
}

module.exports = VueSSR