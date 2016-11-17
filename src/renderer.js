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
const DEFAULT_TITLE_HTML = '{{ _VueSSR_Title }}'
const DEFAULT_KEYWORDS_HTML = '{{ _VueSSR_Keywords }}'
const DEFAULT_DESCRIPTION_HTML = '{{ _VueSSR_Description }}'

const DEFAULT_HEAD_DATA = {
    baseTitle: 'VueSSR',
    baseKeywords: ',VueSSR',
    baseDescription: 'VueSSR',
    title: '',
    description: '',
    keywords: ''
}

function getFileName (webpackServer, projectName) {
    return webpackServer.output.filename.replace('[name]', projectName)
}

class VueSSR {
    constructor ({ projectName, rendererOptions, webpackServer , AppHtml, contextHandler, defaultHeadData }) {
        this.projectName = projectName
        this.rendererOptions = Object.assign({}, DEFAULT_RENDERER_OPTIONS, rendererOptions)
        this.webpackServerConfig = webpackServer
        this.AppHtml = AppHtml || DEFAULT_APP_HTML
        this.contextHandler = contextHandler
        this.HTML = null
        this.template = ''
        this.defaultHeadData = defaultHeadData || DEFAULT_HEAD_DATA
        this.initRenderer()
    }

    headDataInject (context, html) {
        if (!context.headData) context.headData = {}
        let head
        head = html.replace('{{ _VueSSR_Title }}', (context.headData.title || this.defaultHeadData.title) + this.defaultHeadData.baseTitle)
        head = head.replace('{{ _VueSSR_Keywords }}', (context.headData.keywords || this.defaultHeadData.keywords) + this.defaultHeadData.baseKeywords)
        head = head.replace('{{ _VueSSR_Description }}', (context.headData.description || this.defaultHeadData.description) + this.defaultHeadData.baseDescription)
        return head
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

    parseHTML (template) {
        const i = template.indexOf(this.AppHtml)
        this.HTML = {
            head: template.slice(0, i),
            tail: template.slice(i + this.AppHtml.length)
        }
    }

    render (req, res, template) {
        if (this.template !== template) {
            this.parseHTML(template)
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
        
        renderStream.on('data', chunk => {
            if (firstChunk) {
                res.write(this.headDataInject(context, this.HTML.head))
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
            res.end('<script>location.href="/"</script>')
        })
    }
}

module.exports = VueSSR