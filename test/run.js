/* global __dirname, require, process, it */

'use strict';

var
  fs = require('fs')
  , pkg = require('../package.json')
  , business = require('../index.js')
  , testData = require('./dataset/in/test.json')
  , chai = require('chai')
  , expect = chai.expect
  ;

describe(pkg.name + '/index.js', function () {
  describe('#doTheJob', function () {

    it('docObject qui renvoie isConditor:true @1', function (done) {
      var docObject;
      business.doTheJob(docObject = testData[0], function (err) {
        expect(err).to.be.undefined;
        expect(docObject.isConditor).to.be.true;
        done();
      });
    });

    it('docObject qui ne renvoie pas isConditor @2', function (done) {
      var docObject;
      business.doTheJob(docObject = testData[1], function (err) {
        expect(err).to.be.not.undefined;
        expect(err.code).to.equal(1);
        expect(docObject.isConditor).to.be.false;
        done();
      });
    });

    it('docObject qui renvoie isConditor:true @3', function (done) {
      var docObject;
      business.doTheJob(docObject = testData[2], function (err) {
        expect(err).to.be.undefined;
        expect(docObject.isConditor).to.be.true;
        done();
      });
    });

    it('docObjects qui renvoie un docObject en erreur et modifie l\'autre @4', function (done) {
      var docObjects = testData;
      business.finalJob(docObjects, function (err) {
        expect(err).to.be.not.undefined;
        expect(err.length, 'err.length').to.equal(1);
        expect(docObjects.length, 'docObjects.length').to.equal(2);
        expect(docObjects[0].ending).to.equal('finalJob');
        done();
      });
    });

  });
});
