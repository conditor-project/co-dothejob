/* global module, __dirname, require */
/*jslint node: true */
/*jslint indent: 2 */
(function () {
  "use strict";

  var npm = require("npm")
    , config = require(__dirname + "/config.js")
    ;

  !config.app.businessModule.isLocal &&  npm.load(function () {
    var moduleUrl = config.getNpmBusinessModuleUrl();
    var requiredVersion = (moduleUrl.indexOf('#') > 0) ? moduleUrl.split('#')[1] : "";
    config.getBusinessModuleVersion(function(currentVersion) {
      console.log(requiredVersion + " required / "+ currentVersion + " installed");
      if (requiredVersion != currentVersion || requiredVersion === '') {
        console.log("MAJ de la partie métier");
        npm.commands.install([config.getNpmBusinessModuleUrl()], function () {
        });
      } else {
        console.log("inutile de MAJ la partie métier");
      }
    });
  });

}());
