// Generated by CoffeeScript 1.4.0
var AlmondOptimizationTemplate, Build, Bundle, BundleBase, DependenciesReporter, Dependency, Logger, UModule, YADC, getFiles, l, uRequireConfigMasterDefaults, upath, _, _B, _fs, _wrench,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

_ = require('lodash');

_.mixin((require('underscore.string')).exports());

_B = require('uberscore');

_fs = require('fs');

_wrench = require('wrench');

Logger = require('../utils/Logger');

l = new Logger('Bundle');

upath = require('../paths/upath');

getFiles = require("./../utils/getFiles");

uRequireConfigMasterDefaults = require('../config/uRequireConfigMasterDefaults');

AlmondOptimizationTemplate = require('../templates/AlmondOptimizationTemplate');

Dependency = require('../Dependency');

DependenciesReporter = require('./../DependenciesReporter');

UModule = require('./UModule');

Build = require('./Build');

BundleBase = require('./BundleBase');

/*
*/


Bundle = (function(_super) {
  var _this = this;

  __extends(Bundle, _super);

  Function.prototype.property = function(p) {
    var d, n, _results;
    _results = [];
    for (n in p) {
      d = p[n];
      _results.push(Object.defineProperty(this.prototype, n, d));
    }
    return _results;
  };

  Function.prototype.staticProperty = function(p) {
    var d, n, _results;
    _results = [];
    for (n in p) {
      d = p[n];
      _results.push(Object.defineProperty(Bundle.prototype, n, d));
    }
    return _results;
  };

  function Bundle() {
    this._constructor.apply(this, arguments);
  }

  Bundle.prototype.interestingDepTypes = ['notFoundInBundle', 'untrustedRequireDependencies', 'untrustedAsyncDependencies'];

  Bundle.staticProperty({
    requirejs: {
      get: function() {
        return require('requirejs');
      }
    }
  });

  Bundle.prototype._constructor = function(bundleCfg) {
    var filesFilter, getFilesFactory, _fn, _ref,
      _this = this;
    _.extend(this, _B.deepCloneDefaults(bundleCfg, uRequireConfigMasterDefaults.bundle));
    this.main || (this.main = 'main');
    this.bundleName || (this.bundleName = this.main);
    this.uModules = {};
    this.reporter = new DependenciesReporter(this.interestingDepTypes);
    /*
        Read / refresh all files in directory.
        Not run everytime there is a file added/removed, unless we need to:
        Runs initially and in unkonwn -watch / refresh situations
    */

    _ref = {
      filenames: function() {
        return true;
      },
      moduleFilenames: function(mfn) {
        return _B.inAgreements(mfn, _this.includes) && !_B.inAgreements(mfn, _this.excludes);
      }
    };
    _fn = function(bundle) {
      return Bundle.property(_B.okv({}, getFilesFactory, {
        get: (function(getFilesFactory, filesFilter) {
          return function() {
            var deletedFiles, existingFiles, file, files, newFiles, _i, _len, _name;
            existingFiles = (bundle[_name = "_" + getFilesFactory] || (bundle[_name] = []));
            try {
              files = getFiles(bundle.bundlePath, filesFilter);
            } catch (err) {
              err.uRequire = "*uRequire " + l.VERSION + "*: Something went wrong reading from '" + this.bundlePath + "'.";
              l.err(err.uRequire);
              throw err;
            }
            newFiles = _.difference(files, existingFiles);
            if (!_.isEmpty(newFiles)) {
              l.verbose("New " + getFilesFactory + " :\n", newFiles);
              for (_i = 0, _len = newFiles.length; _i < _len; _i++) {
                file = newFiles[_i];
                existingFiles.push(file);
              }
            }
            deletedFiles = _.difference(existingFiles, files);
            if (!_.isEmpty(deletedFiles)) {
              l.verbose("Deleted " + getFilesFactory + " :\n", deletedFiles);
              this.deleteModules(deletedFiles);
              bundle["_" + getFilesFactory] = files;
            }
            return files;
          };
        })(getFilesFactory, filesFilter)
      }, this));
    };
    for (getFilesFactory in _ref) {
      filesFilter = _ref[getFilesFactory];
      _fn(this);
    }
    return this.loadModules();
  };

  /*
      Processes each module, as instructed by `watcher` in a [] paramor read file system (@moduleFilenames)
      @param @build - see `config/uRequireConfigMasterDefaults.coffee`
      @param String or []<String> with filenames to process.
        @default read files from filesystem (property @moduleFilenames)
  */


  Bundle.prototype.loadModules = function(moduleFilenames) {
    var moduleFN, moduleSource, _i, _len, _ref, _results;
    if (moduleFilenames == null) {
      moduleFilenames = this.moduleFilenames;
    }
    _ref = _B.arrayize(moduleFilenames);
    _results = [];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      moduleFN = _ref[_i];
      try {
        moduleSource = _fs.readFileSync("" + this.bundlePath + "/" + moduleFN, 'utf-8');
        if (this.uModules[moduleFN]) {
          if (uM.sourceCode !== moduleSource) {
            delete this.uModule[moduleFN];
          }
        }
        if (!this.uModules[moduleFN]) {
          _results.push(this.uModules[moduleFN] = new UModule(this, moduleFN, moduleSource));
        } else {
          _results.push(void 0);
        }
      } catch (err) {
        l.err('TEMP:' + err);
        if (!_fs.existsSync("" + this.bundlePath + "/" + moduleFN)) {
          l.log("Removed file : '" + this.bundlePath + "/" + moduleFN + "'");
          if (this.uModules[moduleFN]) {
            _results.push(delete this.uModules[moduleFN]);
          } else {
            _results.push(void 0);
          }
        } else {
          err.uRequire = "*uRequire " + l.VERSION + "*: Something went wrong while processing '" + moduleFN + "'.";
          l.err(err.uRequire);
          throw err;
        }
      }
    }
    return _results;
  };

  /*
    @build / convert all uModules that have changed since last @build
  */


  Bundle.prototype.buildChangedModules = function(build) {
    var haveChanges, mfn, uModule, _ref;
    this.build = build;
    if (this.build.template.name === 'combine') {
      if (!this.build.combinedFile) {
        this.build.combinedFile = upath.changeExt(this.build.outputPath, '.js');
        this.build.outputPath = "" + this.build.combinedFile + "__temp";
        l.debug(95, "Setting @build.combinedFile = '" + this.build.outputPath + "' and @build.outputPath = '" + this.build.outputPath + "'");
      }
    }
    this.copyNonModuleFiles();
    haveChanges = false;
    _ref = this.uModules;
    for (mfn in _ref) {
      uModule = _ref[mfn];
      if (!uModule.convertedJs) {
        haveChanges = true;
        uModule.convert(this.build);
        if (_.isFunction(this.build.out)) {
          this.build.out(uModule.modulePath, uModule.convertedJs);
        }
      }
    }
    if (this.build.template.name === 'combine' && haveChanges) {
      this.combine(this.build);
    }
    if (!_.isEmpty(this.reporter.reportData)) {
      return l.log('\n########### urequire, final report ########### :\n', this.reporter.getReport());
    }
  };

  Bundle.prototype.getRequireJSConfig = function() {
    return {
      paths: {
        text: "requirejs_plugins/text",
        json: "requirejs_plugins/json"
      }
    };
  };

  Bundle.prototype.copyAlmondJs = function() {
    try {
      return Build.copyFileSync("" + __dirname + "/../../../node_modules/almond/almond.js", "" + this.build.outputPath + "/almond.js");
    } catch (err) {
      err.uRequire = "uRequire: error copying almond.js from uRequire's installation node_modules - is it installed ?\nTried: '" + __dirname + "/../../../node_modules/almond/almond.js'";
      l.err(err.uRequire);
      throw err;
    }
  };

  Bundle.prototype.copyNonModuleFiles = function() {
    var fn, nonModules, _i, _len, _results;
    nonModules = (function() {
      var _i, _len, _ref, _results;
      _ref = this.filenames;
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        fn = _ref[_i];
        if (__indexOf.call(this.moduleFilenames, fn) < 0) {
          _results.push(fn);
        }
      }
      return _results;
    }).call(this);
    if (!_.isEmpty(nonModules)) {
      l.verbose("Copying non-module/excluded files : \n", nonModules);
      _results = [];
      for (_i = 0, _len = nonModules.length; _i < _len; _i++) {
        fn = nonModules[_i];
        _results.push(Build.copyFileSync("" + this.bundlePath + "/" + fn, "" + this.build.outputPath + "/" + fn));
      }
      return _results;
    }
  };

  /*
     Copy all bundle's webMap dependencies to outputPath
     @todo: should copy dep.plugin & dep.resourceName separatelly
  */


  Bundle.prototype.copyWebMapDeps = function() {
    var depName, webRootDeps, _i, _len, _results;
    webRootDeps = _.keys(this.getDepsVars({
      depType: Dependency.TYPES.webRootMap
    }));
    if (!_.isEmpty(webRootDeps)) {
      l.verbose("Copying webRoot deps :\n", webRootDeps);
      _results = [];
      for (_i = 0, _len = webRootDeps.length; _i < _len; _i++) {
        depName = webRootDeps[_i];
        _results.push(Build.copyFileSync("" + this.webRoot + depName, "" + this.build.outputPath + depName));
      }
      return _results;
    }
  };

  Bundle.prototype.deleteModules = function(modules) {
    var m, _i, _len, _results;
    if (this.uModules[m]) {
      _results = [];
      for (_i = 0, _len = modules.length; _i < _len; _i++) {
        m = modules[_i];
        _results.push(l.debug(50, "delete " + this.uModules[m]));
      }
      return _results;
    }
  };

  /*
  */


  Bundle.prototype.combine = function(build) {
    var almondTemplates, fileName, genCode, rjsConfig, _ref;
    this.build = build;
    almondTemplates = new AlmondOptimizationTemplate({
      globalDepsVars: this.getDepsVars({
        depType: Dependency.TYPES.global
      }),
      main: this.main
    });
    _ref = almondTemplates.dependencyFiles;
    for (fileName in _ref) {
      genCode = _ref[fileName];
      Build.outputToFile("" + this.build.outputPath + "/" + fileName + ".js", genCode);
    }
    this.copyAlmondJs();
    this.copyWebMapDeps();
    try {
      _fs.unlinkSync(this.build.combinedFile);
    } catch (err) {

    }
    rjsConfig = {
      paths: _.extend(almondTemplates.paths, this.getRequireJSConfig().paths),
      wrap: almondTemplates.wrap,
      baseUrl: this.build.outputPath,
      include: this.main,
      out: this.build.combinedFile,
      optimize: "none",
      name: 'almond'
    };
    l.verbose("Optimize with r.js with uRequire's 'build.js' = ", JSON.stringify(_.omit(rjsConfig, ['wrap']), null, ' '));
    this.requirejs.optimize(rjsConfig, function(buildResponse) {
      return l.verbose('r.js buildResponse = ', buildResponse);
    });
    return setTimeout((function() {
      if (_fs.existsSync(build.combinedFile)) {
        l.verbose("Combined file '" + build.combinedFile + "' written successfully.");
        if (Logger.prototype.debugLevel < 50) {
          l.debug(40, "Deleting temporary directory '" + build.outputPath + "'.");
          return _wrench.rmdirSyncRecursive(build.outputPath);
        } else {
          return l.debug("NOT Deleting temporary directory '" + build.outputPath + "', due to debugLevel >= 50.");
        }
      } else {
        return l.err("Combined file '" + build.combinedFile + "' NOT written.\"\n\nPerhaps you have a missing dependcency ? Note you can check AMD files used in temporary directory '" + build.outputPath + "'.");
      }
    }), 100);
  };

  /*
    Gets dependencies & the variables (they bind with), througout this bundle.
  
    The information is gathered from all modules and joined together.
  
    Also it uses bundle.dependencies.variableNames, if some dep has no corresponding vars [].
  
    @param {Object} q optional query with two optional fields : depType & depName
  
    @return {dependencies.variableNames} `dependency: ['var1', 'var2']` eg
                {
                    'underscore': '_'
                    'jquery': ["$", "jQuery"]
                    'models/PersonModel': ['persons', 'personsModel']
                }
  */


  Bundle.prototype.getDepsVars = function(q) {
    var depsAndVars, gatherDepsVars, uMK, uModule, variableNames, vn, _ref, _ref1;
    depsAndVars = {};
    gatherDepsVars = function(depsVars) {
      var dep, dv, v, vars, _results;
      _results = [];
      for (dep in depsVars) {
        vars = depsVars[dep];
        dv = (depsAndVars[dep] || (depsAndVars[dep] = []));
        _results.push((function() {
          var _i, _len, _results1;
          _results1 = [];
          for (_i = 0, _len = vars.length; _i < _len; _i++) {
            v = vars[_i];
            if (__indexOf.call(dv, v) < 0) {
              _results1.push(dv.push(v));
            }
          }
          return _results1;
        })());
      }
      return _results;
    };
    _ref = this.uModules;
    for (uMK in _ref) {
      uModule = _ref[uMK];
      gatherDepsVars(uModule.getDepsAndVars(q));
    }
    if (variableNames = (_ref1 = this.dependencies) != null ? _ref1.variableNames : void 0) {
      vn = _B.go(variableNames, {
        fltr: function(v, k) {
          return (depsAndVars[k] !== void 0) && _.isEmpty(depsAndVars[k]);
        }
      });
      if (!_.isEmpty(vn)) {
        l.warn("\n Had to pick from variableNames for some deps = \n", vn);
      }
      gatherDepsVars(vn);
    }
    return depsAndVars;
  };

  return Bundle;

}).call(this, BundleBase);

if (Logger.prototype.debugLevel > 90) {
  YADC = require('YouAreDaChef').YouAreDaChef;
  YADC(Bundle).before(/_constructor/, function(match, bundleCfg) {
    return l.debug("Before '" + match + "' with bundleCfg = \n", _.omit(bundleCfg, []));
  }).before(/combine/, function(match) {
    return l.debug('combine: optimizing with r.js');
  });
}

module.exports = Bundle;