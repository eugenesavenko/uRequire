# Introduction

**Resource Converters (RC)** are compilers/converters/transpilers etc, that perform a conversion from one resource format (eg coffeescript, less) to another **converted** format (eg javascript, css).


**Resource Converters** is a simplistic, generic, yet evolving *conversions workflow system*, that is trivial to use and extend to cater for all kind of conversions. The workflow has the following principles :

  * *simple callback API* that enables any kind of conversion, even with *one-liners*.

  * focus to *in-memory conversions pipeline*, to save time loading & saving through the filesystem.

  * powerfull *only-when-needed* workflow, where each file is processed/converted only when it really needs to.

  * *seamlessly integrated* with `bundle` & `build` paths, unobstrusivelly loading from and saving to the filesystem with a lean config. It also works smoothly with `build.watch` and the whole uRequire building process.

All [`bundle.filez`](uRequireConfigMasterDefaults.coffee#bundle.filez) that are matched by one or more Resource Converters in [`bundle.resources`](uRequireConfigMasterDefaults.coffee#bundle.resources) are considered as **resources**.

@todo flexible in memory pipelines, where to go next etc.

## Literate Coffescript

This file is written in [Literate Coffeescript](http://ashkenas.com/literate-coffeescript): it serves both as *markdown documentation* AND the *actual code* that represents the *master config*. The code blocks shown are the actual code used at runtime, i.e each key declares its self and sets a default value.

    _ = require 'lodash'
    _B = require 'uberscore'
    l = new _B.Logger 'urequire/config/resourceConverters'
    upath = require '../paths/upath'
    UError = require '../utils/UError'

    BundleFile = require '../fileResources/BundleFile'
    FileResource = require '../fileResources/FileResource'
    TextResource = require '../fileResources/TextResource'
    Module = require '../fileResources/Module'

## Inside a Resource Converter

Each *Resource Converter* (RC) has:

 * `name` : a simple name eg. `'coffeescript'`. A `name` can have various flags at the start of this name - see below. @todo: `name` should be unique

 * `description` : any optional details to keep the name smaller :-)

 * `filez` : a same as [`bundle.filez`](urequireconfigmasterdefaults.coffee#bundle.filez) spec of the files this resource deals with (always withing `bundle.filez` files).

 * `convert` :  a callback eg `function(resource){return convert(resource.source)}` that converts using some resource's data (eg `source`) to an in memory *converted* state or perform any other in memory or external conversion.
 The return of `convert()` is stored as `resource.converted` and its possibly converted again by a subsequent converter. Finally, if it ends up as non falsy, its saved automatically at `resource.dstFilepath` (which uses [`build.dstPath`](urequireconfigmasterdefaults.coffee#build.dstPath)) & `convFilename()` below.

 * `convFilename` :

  * a `function(dstFilename, srcFilename){return 'someConvertedDstFilename.ext')}` that converts the current `dstFilename` (or the `srcFilename`) or to its new *destination* `dstFilename`, eg `'file.coffee'-> 'file.js'`.

  * a `String` starting with '.' (eg ".js"), its considered a simple extension replacement. By default it replaces the extension of current `dstFilename`, but with the `~` flag it performs the extension replacement on `srcFilename` (eg `"~.coffee.md"`).

  * a plain String, returned as is (*note: duplicate destFilename currently cause a build error*).

 * flags `isTerminal`, `isAfterTemplate` & `isMatchSrcFilename` & `type` that can be easily defined via `name` flags - explained below.

Resource Converters are *attached* to files of the bundle (those that match `filez`), the last one determining the class of created resource.

### resource `clazz` & `type`

The `type` is user set among ['bundle', 'file', 'text', 'module'] - the default is undefined.

A resource converter's `type` marks each matching file's clazz either as a `Module`, a `TextResource` or a `FileResource` (but only the last one matters!)

#### FileResource

An external file whose contents we need to know nothing of (but we can if we want). At each conversion, the `convert()` is called, passing a `FileResource` instance with fields:

  * (from `BundleFile`) :
    `srcFilename` - eg
    `srcFilepath` - eg
    `dstFilepath` - eg
    `fileStats` - eg
    `sourceMapInfo` eg
     more ???

You can perform any internal or external conversion in `convert()`. If `convert()` returns non falsy, the content is saved at [`build.dstPath`](urequireconfigmasterdefaults.coffee#build.dstPath).

#### TextResource

A subclass of TextResource Any *textual/utf-8* **Resource**, (eg a `.less` file), denoted by `type:'text'` or via a `'#'` flag preceding its `name` eg `name:'#less'`.

_Key has precedence over name flag, if object format is used - see @type._

#### Module

A **Module** is *javascript code* with node/commonjs `require` or AMD style `define`/`require` dependencies.

Each Module is converted just like a *textual/utf-8* **Resource**, but its dependencies come into play and ultimately it is converted through the chosen [`template`](urequireconfigmasterdefaults.coffee#build.template).

Its is denoted either via key `isModule:true` or via a lack of `'#'` flag preceding its name.

_Again key has precedence over name flag, if object format is used - see @type._

### isTerminal

A converter can be `isTerminal:true` (the default) or `isTerminal:false`.

uRequire uses each matching converter in turn during the build process, converting from one format to the next, using the converted source and dstFilename as the input to the next converter. All that until the first `isTerminal:true` converter is encountered, where the resource conversion process stops.

A converter is by default `isTerminal:false` and can denote it self as `isTerminal:true` in the object format or by using the name flag `'|'`.

### isAfterTemplate

A converter with `isAfterTemplate:true` (refers only to Module converters) will run after the module is converted through its template (eg 'UMD'). By default `isAfterTemplate:false`. Use the `'!'` name flag to denote `isAfterTemplate:true`.

### As an example, the `defaultRecourceConverters`

The following code [(that is actually part of uRequire's code)](#Literate-Coffescript), defines the Default Resource Converters ('javascript', 'coffeescript', 'livescript', 'coco') all as `type:'module' :

    defaultResourceConverters = [

### The proper *Object way* to define a Resource Converter

        # a dummy .js converter
        {
          name: '$JavaScript'            # '$' flag denotes `type: 'module'`.

          description: "I am a dummy js converter, I do nothing but mark `.js` files as `Module`s."

          filez: [                       # type is like `bundle.filez`, defines matching files, matched, marked and converted with this converter

            '**/*.js'                    # minimatch string (ala grunt's 'file' expand or node-glob), with exclusions as '!**/*temp.*'
                                         # RegExps work as well - use [..., `'!', /myRegExp/`, ...] to denote exclusion
            /.*\.(javascript)$/
          ]

          convert: -> @source            # javascript needs no compilation - just return source as is

          convFilename: (srcFilename)->   # convert .js | .javascript to .js
            (require '../paths/upath').changeExt srcFilename, 'js'

          # these are defaults, you can ommit them
          isAfterTemplate: false
          isTerminal: false
          isMatchSrcFilename: false
          type: 'module'                # not needed, since we have '$' flag to denote `type: 'module'`
        }

### The alternative (and less verbose) *Array way* of declaring an RC, using an [] instead of {}.

        [
          '$coffeescript'                                                   # `name` & flags as a String at pos 0

                                                                            # `description` at pos 1
          "Coffeescript compiler, using the locally installed 'coffee-script' npm package. Uses `bare:true`."

          [ '**/*.coffee', /.*\.(coffee\.md|litcoffee)$/i]                  # `filez` [] at pos 2

          do ->                                                             # `convert` Function at pos 3
            coffee = require 'coffee-script'                                # 'store' `coffee` in closure
            -> coffee.compile @source, bare:true                            # return the convert fn

          (srcFn)->                                                         # `convFilename` Function at pos 4
            ext = srcFn.replace /.*\.(coffee\.md|litcoffee|coffee)$/, "$1"  # retrieve matched extension, eg 'coffee.md'
            srcFn.replace (new RegExp ext+'$'), 'js'                        # replace it and teturn new filename
        ]

### The alternative, even shorter `[] way`

        [
          '$livescript'
          [ '**/*.ls']                                                      # if pos 1 is Array, then there's *undefined `description`*
          ->(require 'LiveScript').compile @source, bare:true               # @todo: autodetect *undefined description* if 3rd is a -> or undefined
          '.js'                                                             # if `convFilename` is String starting with '.',
        ]                                                                   # it denotes an ext replacement of dstFilename (or srcFilename if `~` flag is used.

### The shortest way ever, a one-liner converter!

        [ '$coco', [ '**/*.coco'], (->(require 'coco').compile @source, bare:true), '.js']
    ]

## How do we such flexinbility with both [] & {} formats ?

We define an [uBerscore](http://github.com/anodynos/uberscore) `_B.Blender` here, cause it makes absolute sense to exactly define it here!

    resourceConverterBlender = new _B.DeepCloneBlender [
        order:['src']

        '[]': (prop, src)->
          r = src[prop]
          if _.isEqual r, [null]
            r # cater for [null] reset array signpost
          else
            if _.isString(r[1]) and                                       # possibly a `description` @ pos 1, if followed
              (_.isArray(r[2]) or _.isString(r[2]) or _.isRegExp(r[2]) ) # by what looks as `filez` at pos 2
                new ResourceConverter r[0],   r[1],       r[2],     r[3],      r[4]
            else                                                         # pos 1 is not a description, its a `filez`
              new ResourceConverter r[0],   undefined,    r[1],     r[2],      r[3]

        '{}': (prop, src)->
          r = src[prop]
          new ResourceConverter   r.name, r.description, r.filez, r.convert, r.convFilename, r.type, r.isModule, r.isTerminal, r.isAfterTemplate, r.isMatchSrcFilename

        '->': (prop, src)-> # if function, call it (with a dummy object) to search resourceConverters by name or function
          resourceConverter = src[prop].call (search)-> # @todo: src[prop].call with more meaningfull context eg urequire's runtime
            if _.isString search
              resourceConverters[search]
            else
              _.find resourceConverters, (rc)-> search rc

          new ResourceConverter resourceConverter # special call of constructor with an {}
    ]

## A formal `ResourceConverter` creator

    class ResourceConverter
      constructor: (@name, @description, @filez, @convert, @convFilename, @type, isModule, @isTerminal, @isAfterTemplate, @isMatchSrcFilename)->
        if _.isObject @name
          _.extend @, _.omit(@name, 'clazz')
          l.log 'extended obj'

        while @name[0] in ['&','@', '#', '$', '~', '|', '*', '!']
          switch @name[0]
            when '&' then @type = 'bundle'
            when '@' then @type = 'file'
            when '#' then @type = 'text'
            when '$' then @type = 'module'
            when '~' then @isMatchSrcFilename = true
            when '|' then @isTerminal = true
            when '*' then @isTerminal = false # todo: delete '*' case - isTerminal = false is default
            when '!' then @isAfterTemplate = true
          @name = @name[1..] # remove 1st char

        if @type
          if @type not in ['bundle', 'file', 'text', 'module']
            l.err "resourceConverter.type '#{@type}' is invalid - will default to 'bundle'"
          else
            Object.defineProperty @, 'clazz',
              enumerable:false
              value: switch @type
                when 'bundle' then BundleFile
                when 'file' then FileResource
                when 'text' then TextResource
                when 'module' then Module

        if @isModule # isModule is DEPRACATED but still supported (till 0.5 ?)
          l.warn "DEPRACATED key 'isModule' found in `resources` converter '#{name}'. Use `type: 'module'` instead."
          @type = 'module'

        @isTerminal ?= false
        @isAfterTemplate ?= false
        @isMatchSrcFilename ?= false

        if _.isString @convFilename

          if @convFilename[0] is '~'
            @convFilename = @convFilename[1..]
            isSrcFilename = true

          if @convFilename[0] is '.' # filename extension change if it starts with '.'.
                                     # By default it replaces `dstFilename`, with `~` flag it replaces `srcFilename`
            @convFilename =
              do (ext=@convFilename)->
                (dstFilename, srcFilename)->
                  upath.changeExt (if isSrcFilename then srcFilename else dstFilename), ext

          else # return a fn that returns the `convFilename` String
            @convFilename = do (filename=@convFilename)-> -> filename

        else
          if not (_.isFunction(@convFilename) or _.isUndefined(@convFilename))
            l.err uerr = "ResourceConverter error: `convFilename` is not String|Function|Undefined."
            throw new UError uerr, nested:err

@stability: 2 - Unstable

@note *When two ore more files end up with the same `dstFilename`*, build halts. @todo: This should change in the future: when the same `dstFilename` is encountered in two or more resources/modules, it could mean Pre- or Post- conversion concatenation. Pre- means all sources are concatenated & then passed once to `convert`, or Post- where each resource is `convert`ed alone & but their outputs are concatenated onto that same `dstFilename`.

## Exporting resourceConverters

We exported a `resourceConverters` {} with `name` as key & each RC as value. @todo `resourceConverters` should be populated with all RCs loaded (user config ones). @todo: you can then "reference" or "call" an RC from another (user defined) RC!

    resourceConverters = {}

Replace all default RCs to their 'proper' Object format.

    for rc, idxRc in defaultResourceConverters
      defaultResourceConverters[idxRc] = rc = resourceConverterBlender.blend {}, rc
      resourceConverters[rc.name] = rc

    resourceConverters.defaultResourceConverters = defaultResourceConverters # used as-is by master config's `bundle.resources`
    resourceConverters.resourceConverterBlender = resourceConverterBlender

    module.exports = resourceConverters