'use strict';

process.env.VUE_ENV = 'server';

var isDev = NODE_ENV === 'development';

var fs = require('fs');
var path = require('path');
var serialize = require('serialize-javascript');

var createBundleRenderer = require('vue-server-renderer').createBundleRenderer;

var DEFAULT_RENDERER_OPTIONS = {
    cache: require('lru-cache')({
        max: 1000,
        maxAge: 1000 * 60 * 15
    })
};

function getHTML(template) {
    var i = template.indexOf('{{ APP }}');
    return {
        head: template.slice(0, i),
        tail: template.slice(i + '{{ APP }}'.length)
    };
}

function getFileName(webpackServer, projectName) {
    return webpackServer.output.filename.replace('[name]', projectName);
}

var renderer = {};

function VueRender(_ref) {
    var projectName = _ref.projectName;
    var rendererOptions = _ref.rendererOptions;
    var webpackServer = _ref.webpackServer;


    var options = Object.assign({}, DEFAULT_RENDERER_OPTIONS, rendererOptions);

    function createRenderer(bundle) {
        return createBundleRenderer(bundle, options);
    }

    return function (req, res, template) {
        var HTML = getHTML(template);

        if (!isDev) {
            var bundlePath = path.join(webpackServer.output.path, getFileName(webpackServer, projectName));
            renderer[projectName] = createRenderer(fs.readFileSync(bundlePath, 'utf-8'));
        } else {
            require('./bundle-loader')(webpackServer, projectName, function (bundle) {
                renderer[projectName] = createRenderer(bundle);
            });
        }

        if (!renderer[projectName]) {
            return res.end('waiting for compilation... refresh in a moment.');
        }

        var s = Date.now();
        var context = { url: req.url };
        var renderStream = renderer[projectName].renderToStream(context);
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
            if (isDev) {
                console.log('whole request: ' + (Date.now() - s) + 'ms');
            }
        });

        renderStream.on('error', function (err) {
            console.error(err);
        });
    };
}

module.exports = VueRender;