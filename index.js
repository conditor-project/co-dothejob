/* global module */
/*jslint node: true */
/*jslint indent: 2 */
(function () {
  "use strict";
  module.exports = function dothejob(jsonLine, cb) {
    jsonLine.canvasOK = true;

    if (jsonLine.id1 === '2b6372af-c83c-4379-944c-f1bff3ab25d8') {
      jsonLine.canvasOK = false;
      cb({
        code: 1,
        message: 'J\'aime po cet ID là...'
      });
    } else {
      cb();
    }
  };

}());

