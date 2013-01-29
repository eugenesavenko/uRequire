_ = require 'lodash'

pathRelative = require('../paths/pathRelative')
Logger = require '../utils/Logger'
l = new Logger 'ModuleGeneratorTemplates'

Template = require './Template'
#
#  A 'simple' template for a UMD module. Based on https://github.com/umdjs/umd/blob/master/returnExportsGlobal.js
#
#  @param ti {Object} with
#   {
#     modulePath: where the module is, within bundle
#     moduleName: the moduleName, if it exists.
#     moduleType: type of the original module : 'nodejs' or 'AMD'
#     #type: 'define' or 'require': NOT USED
#     arrayDependencies: Array of deps, as delcared in AMD, filerelative (eg '../PersonView' for 'views/PersonView') + all `require('dep')`
#     nodeDependencies: Array for file-relative dependencies, as required by node (eg '../PersonView')
#     parameters: Array of parameter names, as declared on the original AMD.
#     rootExports: Array with names 'root' variable(s) to export on the browser side (or false/undefined)
#     noConflict: if true, inject a noConflict() method on this module, that reclaims all rootExports to their original value and returns this module.
#     factoryBody: The actual code that returns our module (define) or just runs some code having dependencies resolved (require).
#     webRootMap: path of where to map '/' when running on node, relative to bundleRoot (starting with '.'), absolute OS path otherwise.
#  }
#
# @todo: recognise define [], -> or require [], -> and adjust both node & browser UMD accordingly
# @todo: make unit tests

module.exports =

class ModuleGeneratorTemplates extends Template
  constructor:-> @_constructor.apply @, arguments

  ###
  @param @ti the templateInfo
  ###
  _constructor: (@ti)->
    @header = "// Generated by uRequire v#{l.VERSION}\n"

    @moduleNamePrint = if ti.moduleName then "'#{ti.moduleName}', " else ""

    ### @property parameters of the factory method, eg 'require, _, personModel' ###
    @parametersPrint = """
      require#{if (ti.moduleType is 'nodejs') then ', exports, module' else ''}#{
      (", #{par}" for par in ti.parameters).join ''}
    """

    ### @property arrayDependencies of define [], eg "['require', 'lodash', 'PersonModel']" ###
    @arrayDependenciesPrint = """
      #{
        if _.isEmpty ti.arrayDependencies
          "" #keep empty [] not existent, enabling requirejs scan
        else
          if ti.moduleType is 'nodejs'
            "['require', 'exports', 'module'"
          else
            "['require'"
      }#{
        (", '#{dep}'" for dep in ti.arrayDependencies).join('')
      }#{
        if _.isEmpty ti.arrayDependencies then '' else '], '
      }
      """

    @bodyStart = "// uRequire: start body of original #{ti.moduleType} module"
    @bodyEnd = "// uRequire: end body of original #{ti.moduleType} module"

    @factoryBodyPrint = """
      #{@bodyStart}
      #{@ti.factoryBody}
      #{@bodyEnd}

      #{ if (@ti.moduleType is 'nodejs') then '\nreturn module.exports;' else '' }
    """

  ### private ###
  _rootExportsNoConflict: (factoryFn, rootName='root')-> """

    var m = #{factoryFn};
    #{
      if @ti.noConflict
        ("#{if i is 0 then 'var ' else '    '}old_#{exp} = #{rootName}.#{exp}" for exp, i in @ti.rootExports).join(',\n') + ';'
      else ''
    }

    #{("#{rootName}.#{exportedVar} = m" for exportedVar in @ti.rootExports).join(';\n') };

    """ + (
      if @ti.noConflict
        "m.noConflict = " + @_function("""
              #{("  #{rootName}.#{exp} = old_#{exp}" for exp in @ti.rootExports).join(';\n')};
              return m;
            """)

      else
        ''
    ) + "\nreturn m;"


  ###
    UMD template - runs AS-IS on both Web/AMD and nodejs (having 'npm install urequire').
    * Uses `NodeRequirer` to perform `require`s.
  ###
  UMD: ->
    @header +
    @_functionIFI(
      @runTimeDiscovery +
      @_functionIFI("""
         if (typeof exports === 'object') {
            var nr = new (require('urequire').NodeRequirer) ('#{@ti.modulePath}', module, __dirname, '#{@ti.webRootMap}');
            module.exports = factory(nr.require#{
              if (@ti.moduleType is 'nodejs') then ', exports, module' else ''}#{
              (", nr.require('#{nDep}')" for nDep in @ti.nodeDependencies).join('')});
          } else if (typeof define === 'function' && define.amd) {
              define(#{@moduleNamePrint}#{@arrayDependenciesPrint}#{
                if not _.isEmpty(@ti.rootExports) # Adds browser/root globals
                  @_function(
                    @_rootExportsNoConflict("factory(#{@parametersPrint})")
                    ,
                    @parametersPrint)
                else
                  'factory'
                });
          }
        """,
        # parameters + values to our IFI
        'root', 'this', # todo: root / global NOT WORKING on nodejs - maybe we need (global || window || this)
        'factory', @_function(@factoryBodyPrint, @parametersPrint)
      )
    ) + ';'


  ### AMD template
      Simple `define(['dep'], function(dep){...body...}})`
      Runs only on WEB/AMD/RequireJs (and hopefully soon in node through uRequire'd *driven* RequireJS).
  ###
  AMD: ->
      @header +
      @_functionIFI @runTimeDiscovery +
             @_AMD_plain_define()

  _AMD_plain_define:->"""
    define(#{@moduleNamePrint}#{@arrayDependenciesPrint}
      #{
        #our factory function
        @_function(
          # codeBody
          if not @ti.rootExports # 'standard' AMD format
            @factoryBodyPrint
          else # ammend to export window = @ti.rootExports
            @_rootExportsNoConflict(
              @_functionIFI(@factoryBodyPrint,
                    @parametersPrint, @parametersPrint)
              ,
              'window') # rootName
          ,
          # our factory function declaration params
          @parametersPrint)
      }
    );
  """

  # 'combined' is based on AMD, infusing global as window in case we have rootExports/noConflict
  combined: -> @_functionIFI @_AMD_plain_define(), 'window', '__global'

  nodejs: -> """
      #{@header}#{
        if @ti.parameters.length > 0 then "\nvar " else ''}#{
        ("#{if pi is 0 then '' else '    '}#{
          param} = require('#{@ti.nodeDependencies[pi]}')" for param, pi in @ti.parameters).join(',\n')
      };

      #{@runTimeDiscovery}

      #{@bodyStart}
      #{ if @ti.moduleType is 'AMD'
          "module.exports = #{@_functionIFI @ti.factoryBody};"
        else
          @ti.factoryBody
      }
      #{@bodyEnd}
    """

### Debug information ###

#if l.debugLevel > 90
#  YADC = require('YouAreDaChef').YouAreDaChef
#
#  (YADC ModuleGeneratorTemplates)
#    .before /_constructor/, (match, ti)->
#      l.debug "Before '#{match}' with 'templateInfo' = \n", _.omit(ti, ['factoryBody', 'webRootMap', ])
#
