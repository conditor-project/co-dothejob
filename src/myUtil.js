'use strict';

var fs = require('fs-extra')
  , _util = {};

module.exports = _util;

_util.readFileSyncIfExist = function(fileName) {
  var file
    , _msg;

  try {
    file = fs.readFileSync(fileName, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") {
      _msg = "Pas de fichier " + fileName;
      return;
    } else {
      throw e;
    }
  }

  return file;
};

_util.copySyncIfExist = function(src, dest) {

  try {
    fs.copySync(src, dest);
  } catch (e) {
    if (e.code === "ENOENT") {

      return;
    } else {
      throw e;
    }
  }
};

_util.unlinkSyncIfExist = function(path) {
  try {
    fs.unlinkSync(path);
  } catch (e) {
    if (e.code === "ENOENT") {

      return;
    } else {
      throw e;
    }
  }
};


