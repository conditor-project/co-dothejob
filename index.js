/* global module */
/*jslint node: true */
/*jslint indent: 2 */
"use strict";

var business = {};

business.doTheJob = function (jsonLine, cb) {
    jsonLine.isConditor = true;
    if (jsonLine.project !== 'conditor') {
      jsonLine.isConditor = false;
      return cb({
        code: 1,
        message: 'ici, on ne veut QUE du conditor...'
      });
    } else {
      return cb();
    }
};

business.finalJob = function (docObjects, cb) {
    var err = [];
    err.push(docObjects.pop());
    docObjects[0].ending = 'finalJob';
    return cb(err);
};

module.exports = business;
