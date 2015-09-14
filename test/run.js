/* global require, __dirname */
'use strict';

var expect = require('chai').expect;
var fs = require('fs');
var pkg = require('../package.json');
var exec = require('child_process').exec;
var glob = require('glob');
var test;

describe('Module ' + pkg.name + ' ./run script :', function () {

  before(function (done) {
    exec(__dirname + '/../src/install TEST_1970-01-01-00-00-00 test', function (code) {
      if (code !== 0) new Error('Impossible de créer l\'arborescence dans le ./in');
      done();
    });
    this.timeout(50000); // timeout car la création de l'arbo est très longue
  });

  it(' devrait avoir un répertoire ./in/TEST_1970-01-01-00-00-00/a/0/f/ vide @1', function (done) {
    var testDir = __dirname + '/../in/TEST_1970-01-01-00-00-00/a/0/f';
    test = expect(fs.existsSync(testDir)).to.be.true;
    glob(testDir + '/*', function (err, files) {
      test = expect(files).to.be.empty;
      done();
    });
  });

  it(' devrait créer les liens symboliques vers le jeu de test @2', function (done) {
    exec(__dirname + '/../src/sym-links TEST_1970-01-01-00-00-00 test/dataset/in', function (err) {
      test = expect(err, ' le script de lien symbolique doit retourner 0 (err = null)').to.be.null;
      done();
    });
  });

  it(' ne devrait pas planter @3', function (done) {
    exec(__dirname + '/../run --standalone TEST_1970-01-01-00-00-00', function (err, stdout, stderr) {
      test = expect(err, ' run doit retourner 0 (err = null)').to.be.null;
      console.log(stderr, stdout);
      var finishedFile = __dirname + '/../sessions/TEST_1970-01-01-00-00-00/finished';
      var readyFile = __dirname + '/../sessions/TEST_1970-01-01-00-00-00/ready';
      test = expect(fs.existsSync(finishedFile)).to.be.true;
      test = expect(fs.existsSync(readyFile)).to.be.true;
      expect(fs.readFileSync(finishedFile, {encoding: 'utf8'})).to.be.equal('1');
      expect(fs.readFileSync(readyFile, {encoding: 'utf8'})).to.be.equal('0');

      done();
    });
  });


  it(' il devrait y avoir le fichier a0f4a50a-ddd0-4649-999c-12013063a68f.json dans "/out/TEST_1970-01-01-00-00-00/a/0/f/ @4"', function (done) {
    var testDir = __dirname + '/../out/TEST_1970-01-01-00-00-00/a/0/f';
    var testFile = 'a0f4a50a-ddd0-4649-999c-12013063a68f.json';

    test = expect(fs.existsSync(testDir)).to.be.true;
    test = expect(fs.existsSync(testDir + '/' + testFile), testFile + ' devrait exister dans ' + testDir).to.be.true;

    done();
  });

  it(' il devrait y avoir le fichier a0f64cfa-da46-4bd9-a542-4a745c98256d.json dans "/err/TEST_1970-01-01-00-00-00/a/0/f/ @5.1"', function (done) {
    var testDir = __dirname + '/../err/TEST_1970-01-01-00-00-00/a/0/f';
    var testFile = 'a0f64cfa-da46-4bd9-a542-4a745c98256d.json';

    test = expect(fs.existsSync(testDir)).to.be.true;
    test = expect(fs.existsSync(testDir + '/' + testFile), testFile + ' devrait exister dans ' + testDir).to.be.true;

    done();
  });

  it(' il devrait y avoir le fichier a0f4a50a-ddd0-4649-999c-12013063a68f.json dans "/err/TEST_1970-01-01-00-00-00/a/0/f/ @5.2"', function (done) {
    var testDir = __dirname + '/../err/TEST_1970-01-01-00-00-00/a/0/f';
    var testFile = 'a0f4a50a-ddd0-4649-999c-12013063a68f.json';

    test = expect(fs.existsSync(testDir)).to.be.true;
    test = expect(fs.existsSync(testDir + '/' + testFile), testFile + ' devrait exister dans ' + testDir).to.be.true;

    done();
  });

  it(' devrait retourner une erreur si des caractères non autorisés sont présent dans la session @6', function (done) {
    exec(__dirname + '/../run --standalone "GOODANDbad"', function (err, stdout, stderr) {
      expect(err, ' run doit retourner une erreur car le nom de session n\'est pas autorisé').to.be.not.null;
      expect(err.code, ' le code d\'erreur devrait avoir la valeur 1').to.be.equal(1);
      done();
    });
  });

  after(function (done) {
    // executed after every tests
    exec(__dirname + '/../src/clean TEST_1970-01-01-00-00-00', function (code) {
      if (code !== 0) new Error('Impossible de nettoyer la session');
      done();
    });
    this.timeout(50000);  // timeout car la destruction de l'arbo est potentiellement très longue
  });

});


