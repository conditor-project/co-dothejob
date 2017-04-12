/* global module, __dirname, require */
/*jslint node: true */
/*jslint indent: 2 */
(function () {
  "use strict";

  var
    spawn = require("child_process").spawnSync
    , config = require(__dirname + "/config.js")
    , mochaArgs = ["test", "--colors"]
    , spawned
    ;
console.log(config.getTestPath());
  mochaArgs.push(config.getTestPath());

  spawned = spawn("./node_modules/.bin/mocha", mochaArgs, {encoding: "utf-8"});

  console.log(spawned.stdout, spawned.stderr);
}());
