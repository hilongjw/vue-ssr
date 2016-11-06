'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var fs = require('fs');
var path = require('path');
var serialize = require('serialize-javascript');

process.env.VUE_ENV = 'server';

var NODE_ENV = process.env.NODE_ENV || 'production';
var isDev = NODE_ENV === 'development';

var createBundleRenderer = require('vue-server-renderer').createBundleRenderer;
var DEFAULT_RENDERER_OPTIONS = {
    cache: require('lru-cache')({
        max: 1000,
        maxAge: 1000 * 60 * 15
    })
};

var DEFAULT_APP_HTML = '{{ APP }}';

function getFileName(webpackServer, projectName) {
    return webpackServer.output.filename.replace('[name]', projectName);
}

var VueSSR = function () {
    function VueSSR(_ref) {
        var projectName = _ref.projectName;
        var rendererOptions = _ref.rendererOptions;
        var webpackServer = _ref.webpackServer;
        var AppHtml = _ref.AppHtml;
        var contextHandler = _ref.contextHandler;

        _classCallCheck(this, VueSSR);

        this.projectName = projectName;
        this.rendererOptions = Object.assign({}, DEFAULT_RENDERER_OPTIONS, rendererOptions);
        this.webpackServerConfig = webpackServer;
        this.AppHtml = AppHtml || DEFAULT_APP_HTML;
        this.contextHandler = contextHandler;
        this.HTML = null;
        this.template = '';
        this.initRenderer();
    }

    _createClass(VueSSR, [{
        key: 'createRenderer',
        value: function createRenderer(bundle) {
            return createBundleRenderer(bundle, this.rendererOptions);
        }
    }, {
        key: 'initRenderer',
        value: function initRenderer() {
            var _this = this;

            if (this.renderer) {
                return this.renderer;
            }

            if (!isDev) {
                var bundlePath = path.join(this.webpackServerConfig.output.path, getFileName(this.webpackServerConfig, this.projectName));
                this.renderer = this.createRenderer(fs.readFileSync(bundlePath, 'utf-8'));
            } else {
                require('./bundle-loader')(this.webpackServerConfig, this.projectName, function (bundle) {
                    _this.renderer = _this.createRenderer(bundle);
                });
            }
        }
    }, {
        key: 'parseHTML',
        value: function parseHTML(template) {
            var i = template.indexOf(this.AppHtml);
            this.HTML = {
                head: template.slice(0, i),
                tail: template.slice(i + this.AppHtml.length)
            };
        }
    }, {
        key: 'render',
        value: function render(req, res, template) {
            if (this.template !== template) {
                this.parseHTML(template);
            }

            if (!this.renderer) {
                return res.end('waiting for compilation... refresh in a moment.');
            }

            var context = { url: req.url };

            if (this.contextHandler) {
                context = this.contextHandler(req);
            }

            this.RenderToStream(context, res);
        }
    }, {
        key: 'RenderToStream',
        value: function RenderToStream(context, res) {
            var _this2 = this;

            var renderStream = this.renderer.renderToStream(context);
            var firstChunk = true;

            res.write(this.HTML.head);
            renderStream.on('data', function (chunk) {
                if (firstChunk) {
                    if (context.initialState) {
                        res.write('<script>window.__INITIAL_STATE__=' + serialize(context.initialState, { isJSON: true }) + '</script>');
                    }
                    firstChunk = false;
                }
                res.write(chunk);
            });

            renderStream.on('end', function () {
                res.end(_this2.HTML.tail);
            });

            renderStream.on('error', function (err) {
                console.error(err);
            });
        }
    }]);

    return VueSSR;
}();

module.exports = VueSSR;