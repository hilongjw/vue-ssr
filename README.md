# Vue SSR

Use Vue 2.0 server-side rendering with Express

## Installation

```sh
npm i vue-ssr --save
```

## Usage

```javascript
const express = require('express')
const router = express.Router()

const VueSSR = require('vue-ssr')

// webpack server-side bundle config
const serverConfig = require('path to webpack.server.js')

// create a project renderer
const indexRenderer = new VueSSR({
    projectName: 'index', 
    rendererOptions: {
        cache: require('lru-cache')({
            max: 1000,
            maxAge: 1000 * 60 * 15
        })
    }, 
    webpackServer: serverConfig
})

// handle 
function indexView (req, res) => {
    indexRenderer.render(req, res, `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>Cov-X</title>
        {{ STYLE }}
      </head>
      <body>
        {{ APP }}
        <script src="/dist/client-bundle.js"></script>
      </body>
    </html>
    `)
}

router.get('/', indexView)
router.get('/home', indexView)
router.get('/article', indexView)
router.get('/tag', indexView)

```

## API

### projectName

project name of webpack entries that you want to server side rendering

```
// webpack config

...

entry: {
    index: ['../path to app client entry'],
    dashboard: ['../path to dashboard project client entry']
},

...
```

```
const indexRenderer = new VueSSR({
    projectName: 'index',
    webpackServer: serverConfig
})

const dashRenderer = new VueSSR({
    projectName: 'dashboard',
    webpackServer: serverConfig
})
```

### rendererOptions

rendererOptions is [Vue server renderer](https://github.com/vuejs/vue/tree/dev/packages/vue-server-renderer#renderer-options) options

#### directives

Allows you to provide server-side implementations for your custom directives:

```
const indexRenderer = new VueSSR('index', {
  directives: {
    example (vnode, directiveMeta) {
      // transform vnode based on directive binding metadata
    }
  }
}, serverConfig)
```

#### cache

```
const indexRenderer = new VueSSR('index', {
    cache: require('lru-cache')({
        max: 1000,
        maxAge: 1000 * 60 * 15
    })
}, serverConfig)
```

[Why Use bundleRenderer?](https://github.com/vuejs/vue/tree/dev/packages/vue-server-renderer#creating-the-server-bundle)

### webpackServer

for example [webpack.server.js](https://github.com/hilongjw/vue-express-hot-simple/blob/master/build/webpack.server.js)

```
const serverConfig = require('path to webpack.server.js')

const indexRenderer = new VueSSR({
    projectName: 'index', 
    webpackServer: serverConfig
})
```

### AppHtml

The default AppHtml is  `{{ APP }}`, rendering of the server side is replaced by AppHtml

```html
<html>
<body>
    {{ APP }}
</body>
</html>
```

```html
<html>
<body>
    <div id="app" server-rendered="true">
        ...
    </div>
</body>
</html>

```

You can also customize it 

```javascrit

const indexRenderer = new VueSSR({
    projectName: 'index',
    webpackServer: serverConfig,
    AppHtml: '<div id="app"></div>'
})

```

### contextHandler

```
const indexRenderer = new VueSSR({
    contextHandler: function (req) {
        return {
            url: req.url,
            ua: uaParser(req.headers['user-agent'])
        }
    }
})
```

### defaultHeadData

```javascript
const indexRenderer = new VueSSR({
    defaultHeadData: {
        baseTitle: 'VueSSR',
        baseKeywords: ',vue-ssr',
        baseDescription: 'Vue server-side rendering',
        title: '',
        description: '',
        keywords: ''
    }
})
```

```jade
head
    meta(charset="utf-8")
    meta(name="renderer", content="webkit")
    title {{ _VueSSR_Title }}
    meta(name="viewport", content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no")
    meta(name="keywords", content="{{ _VueSSR_Keywords }}")
    meta(name="description", content="{{ _VueSSR_Description }}")
```

server-entry.js

```
export default context => {
    router.push(context.url)
    return Promise.all(router.getMatchedComponents().map(component => {
        if (component.preFetch) {
            return component.preFetch(store, router, context)
        }
    })).then(() => {
        context.initialState = store.state
        return app
    })
}
```

simple component

```javascript
export default {
    preFetch (store, router, context) {
        context.headData = {
            title: 'this article's title,
            description: 'about this article',
            keywords: 'Vue,vuejs,javascript'
        }
        return Promise.resolve()
    }
}
```



# Example

[vue-express-hot-simple](https://github.com/hilongjw/vue-express-hot-simple)


# License

  MIT




