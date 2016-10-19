'use strict';

var fs = require('fs');
var path = require('path');
var serialize = require('serialize-javascript');
var uaParser = require('ua-parser-js');

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

var VueRenderer = {};
var DEFAULT_APP_HTML = '{{ APP }}';

function parseHTML(template) {
    var i = template.indexOf(DEFAULT_APP_HTML);
    return {
        head: template.slice(0, i),
        tail: template.slice(i + DEFAULT_APP_HTML.length)
    };
}

function getFileName(webpackServer, projectName) {
    return webpackServer.output.filename.replace('[name]', projectName);
}

function initRenderer(webpackServer, projectName, createRenderer) {
    if (VueRenderer[projectName]) {
        return VueRenderer[projectName];
    }

    if (!isDev) {
        var bundlePath = path.join(webpackServer.output.path, getFileName(webpackServer, projectName));
        VueRenderer[projectName] = createRenderer(fs.readFileSync(bundlePath, 'utf-8'));
    } else {
        require('./bundle-loader')(webpackServer, projectName, function (bundle) {
            VueRenderer[projectName] = createRenderer(bundle);
        });
    }
}

function VueRender(_ref) {
    var projectName = _ref.projectName;
    var rendererOptions = _ref.rendererOptions;
    var webpackServer = _ref.webpackServer;
    var AppHtml = _ref.AppHtml;
    var contextHandler = _ref.contextHandler;


    var options = Object.assign({}, DEFAULT_RENDERER_OPTIONS, rendererOptions);

    if (AppHtml) {
        DEFAULT_APP_HTML = AppHtml;
    }

    function createRenderer(bundle) {
        return createBundleRenderer(bundle, options);
    }

    return function (req, res, template) {
        var HTML = parseHTML(template);

        var renderer = initRenderer(webpackServer, projectName, createRenderer);

        if (!renderer) {
            return res.end('waiting for compilation... refresh in a moment.');
        }

        var context = void 0;

        if (contextHandler) {
            context = contextHandler(req);
        } else {
            context = { url: req.url };
        }

        RenderToStream(renderer, context, HTML, res);
    };
}

function RenderToStream(renderer, context, HTML, res) {
    var renderStream = renderer.renderToStream(context);

    var firstChunk = true;
    res.write(HTML.head);

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
        res.end(HTML.tail);
    });

    renderStream.on('error', function (err) {
        console.error(err);
    });
}

module.exports = VueRender;