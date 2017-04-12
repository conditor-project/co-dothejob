/* global module, __dirname, process, e, require */
/*jslint node: true */
/*jslint indent: 2 */

(function () {
  "use strict";
  var
    //Core modules
    fs = require("fs")
    , path = require("path")
    , util = require("util")

    //Npm modules
    , yaml = require("js-yaml")
    , _ = require("lodash")

    //others
    , colors = require("./myColors")
    , defaultParameters
    , defaultConfig
    , userParameters
    , userConfig
    , config = {}
  , _util = {}
  ;

  _util.readFileSyncIfExist = function (fileName) {
    var file
      , _msg;

    try {
      file = fs.readFileSync(fileName, "utf8");
    } catch(e) {
      if (e.code === "ENOENT") {
        _msg = "Pas de fichier " + fileName;
        return;
      }
      else {
        throw e;
      }
    }

    return file;
  };

  _util.getLocalBusinessModulePath = function () {
    return path.join(
      __dirname,
      "..",
      config.parameters.modules.localPath.repository,
      config.parameters.modules.localPath[config.app.businessModule.module]
      );
  };

  _util.getLocalTestPath = function () {
    return path.join(
      _util.getLocalBusinessModulePath(),
      "test"
      );
  };

  _util.getNpmTestPath = function () {
    return path.join(
      _util.getRoot(),
      "node_modules",
      config.app.businessModule.module,
      "test"
      );
  };

  _util.resolveRoot = function () {
    var i = 10
      , file
      , parentPath = ""
      , searchPath
      ;

    while (i--) {
      searchPath = path.join(__dirname, parentPath);
      file = _util.readFileSyncIfExist(searchPath + "/root.flag");
      i = file ? 0 : i;
      parentPath += '/..';
    }

    return this.rootPath = file && searchPath || null;
  };

  _util.getRoot = function () {
    return this.rootPath || _util.resolveRoot();
  };

  _util.rootPathJoin = function () {
    var args = Array.prototype.slice.call(arguments);
    args.splice(0, 0, this.getRoot());

    return path.join.apply(path, args);
  };

  _util.getMode = function () {
    return config.app.businessModule.isLocal && "mode local" || '';
  };


  defaultParameters = yaml.load(fs.readFileSync(_util.rootPathJoin("parameters.yml.dist"), "utf8"));
  defaultConfig = yaml.load(fs.readFileSync(_util.rootPathJoin("config.yml.dist"), "utf8"));
  userParameters = yaml.load(_util.readFileSyncIfExist(_util.rootPathJoin("parameters.yml")));
  userConfig = yaml.load(_util.readFileSyncIfExist(_util.rootPathJoin("config.yml")));

  config = _.defaultsDeep({}, userConfig, defaultConfig, userParameters, defaultParameters);


  /*
   * The project root path
   */
  config.app.root = _util.getRoot();

  /*
   * Return suitable test path
   * @returns string
   */
  config.getTestPath = function () {
    return config.app.businessModule.isLocal && _util.getLocalTestPath()
      || _util.getNpmTestPath();
  };

  /*
   * Return suitable module url for npm install
   * @returns string
   */
  config.getNpmBusinessModuleUrl = function () {
    return config.parameters.modules.npmPath.repository + config.parameters.modules.npmPath[config.app.businessModule.module];
  };

  /*
   * Return suitable business module for require
   * @returns string
   */
  config.getBusinessModule = function () {
    return this.app.businessModule.isLocal && _util.getLocalBusinessModulePath() || this.app.businessModule.module;
  };

  /*
   * Return absolute path where business module is installed
   * @returns string
   */
  config.getBusinessModulePath = function () {
    var res = "";
    if (this.app.businessModule.isLocal) {
      res = _util.getLocalBusinessModulePath();
    } else {
      res = path.join(_util.getRoot(),"node_modules",config.getBusinessModule());
    }
    return res;
  };

  /*
   * Return installed business module version
   * @returns string
   */
  config.getBusinessModuleVersion = function (cb) {
    var packageFilePath = path.join(config.getBusinessModulePath(),"package.json");
    var version = "";
    fs.stat(packageFilePath, function (err,stats) {
      if (!err && stats.isFile()) {
        var packageJson = require(path.join(config.getBusinessModulePath(),"package.json"));
        version = "v" + packageJson.version;
      }
      cb(version);
    });
  };

  /*
   * Return loggable config object representation
   */
  config.selfInspect = function () {
    return util.inspect(this, {depth: 10});
  };

  /*
   * Specifics log for config object
   */
  config.log = function () {
    console.log(this.selfInspect());
  };

  config.toString = function () {

    return "##".muted + "config" + "##".muted + "\n"
      + "module: ".muted + config.app.businessModule.module + "\n"
      + "root:   ".muted + config.app.root + "\n"
      + _util.getMode().warning
      ;
  };

  module.exports = config;
}());
