/*global module, process, err, require, __dirname, e */
/*jslint node: true */
/*jslint indent: 2 */
'use strict';

/*
 * Module qui :
 *   - gère la lecture des lots (fichiers JSON) line par ligne
 *   - effectue l'appel principal au code métier
 *   - écrit les résultats dans les répertoires OUT et ERR
 */

// Core modules
var
  util          = require('util'),
  _             = require('lodash')
  , redisPort   = process.env.REDIS_PORT || 6379
  , redisHost   = process.env.REDIS_HOST || 'localhost'

  // Npm modules
  , redisClient = require('redis').createClient({'host': redisHost, 'port': redisPort})
  , fs          = require('fs-extra')
  , async       = require('async')
  , mkdirp      = require('mkdirp')
  , Log         = require('log')

  // Others
  , config      = require(__dirname + '/config.js')
  , business    = require(config.getBusinessModule())
  , _util       = require('./myUtil')
  , logProcess
  , logErr
  ;

logProcess = new Log('info', fs.createWriteStream(process.env.LOGFILE, {flags: 'a'}));
logErr     = new Log('error', fs.createWriteStream(process.env.LOGFILEERR, {flags: 'a'}));


var redisKey       = process.env.ISTEX_SESSION + ':' + process.env.MODULENAME,
    outChannelName = redisKey + ':out',
    errChannelName = redisKey + ':err',
    inChannelName  = redisKey + ':in',
    debug;

var main = function(basename) {

  // notre fichier contenant 1 JSON par ligne
  var splitDir = process.env.ISTEX_SESSION + '/' + basename[0] + '/' + basename[1] + '/' + basename[2];
  var inFile   = process.env.DIR_IN + '/' + splitDir + '/' + basename;

  // les destinations où seront écrit les résultats
  var outFile = process.env.DIR_OUT + '/' + splitDir + '/' + basename;
  mkdirp.sync(process.env.DIR_OUT + '/' + splitDir);
  var errFile = process.env.DIR_ERR + '/' + splitDir + '/' + basename;
  mkdirp.sync(process.env.DIR_ERR + '/' + splitDir);

  logProcess.info('Traitement démarré sur le fichier ' + inFile);

  // lecture ligne par ligne du fichier JSON source
  var lines =
        fs.readFileSync(inFile, {encoding: 'utf-8'})
          .trim()
          .split('\n');

  var q, errCount = 0,
      outCount    = 0,
      docObjects  = [];

  q = async.queue(function(line, callback) {
    var
      docObject, _errMsg;

    try {
      docObject = JSON.parse(line);
    } catch (err) {
      _errMsg      = 'Erreur de parsing JSON, ligne: ' + (lines.indexOf(line) + 1) + ' fichier: ' + inFile;
      err.message += _errMsg;
      err.fileName = "li-module.js";
      logErr.error(_errMsg);
      ++errCount;
      fs.appendFileSync(errFile, JSON.stringify({JsonParseError: line}) + '\n');

      return callback(err);
    }

    logProcess.info("Début du traitement de " + docObject.idIstex);

    business.doTheJob(docObject, function(err, options) {
      var _errMsg;

      if (options) {
        options.errLogs && options.errLogs.forEach(function(_log) {
          logErr.error(_log);
        });

        options.processLogs && options.processLogs.forEach(function(_log) {
          logProcess.info(_log);
        });
      }

      if (err) {
        _errMsg = 'doTheJob a renvoyé une erreur (code ' + err.code + ') lors du traitement du docObject de la ligne ' + (lines.indexOf(
            line) + 1) + ' du fichier ' + inFile + ' : ' + err.message;
        logErr.error(_errMsg);
        ++errCount;
        fs.appendFileSync(errFile, JSON.stringify(docObject) + '\n');
        
        if (!err.nonBlocking) return callback(err);
      }

      docObjects.push(docObject);
      logProcess.info("Fin du traitement de " + docObject.idIstex);

      return callback();

    });
  }, 1);

  var next = function() {
    async.series(
      [
        async.apply(redisClient.hincrby.bind(redisClient), 'Module:' + redisKey, 'outDocObject', docObjects.length),
        async.apply(redisClient.hincrby.bind(redisClient), 'Module:' + redisKey, 'errDocObject', errCount)
      ],
      function(err) {

        err && logErr.error(err);

        if (docObjects.length !== 0) {
          var docsOut = _(docObjects).map(JSON.stringify).join('\n');
          fs.writeFileSync(outFile, docsOut, 'utf8');
        }

        _util.unlinkSyncIfExist(inFile);

        logProcess.info('Traitement terminé sur : ' + inFile);

        /* TODO: exit peut être un probléme du fait de l'asyncronisme, un event serait mieux adapté */
        process.exit(0);

      });
  }

  q.drain = function() {

    // déplace le fichier temporaire à son emplacement final
    // supprime le fichier source (du répertoire in/)
    // lorsque toutes les lignes du fichier in ont été traitées
    // le publish vers le channel out sera fait par fork.js

    if (business.finalJob) {
      business.finalJob(docObjects, function(err, options) {
        var _errMsg, i;

        if (options) {
          options.errLogs && options.errLogs.forEach(function(_log) {
            logErr.error(_log);
          });

          options.processLogs && options.processLogs.forEach(function(_log) {
            logProcess.info(_log);
          });
        }

        if (Array.isArray(err)) {
          // On parcourt l'ensemble des docObject en erreur
          for (i = 0; i < err.length; i++) {
            _errMsg = 'Une ou plusieurs erreurs (code ' + err[i].code + ') détectée(s) lors du traitement final du fichier ' + inFile + ' : ' + err[i].idIstex + ' ' + err[i].message;
            logErr.error(_errMsg);
            ++errCount;
            fs.appendFileSync(errFile, JSON.stringify(err[i]) + '\n');
          }
        } else if (err) {
          _errMsg = 'Erreur lors du traitement global fichier ' + inFile + ' : ' + err.errCode + ' ' + err.errMessage;
          logErr.error(_errMsg);
          fs.appendFileSync(errFile, _errMsg + '\n');
        }

        logProcess.info("Fin du traitement final de " + basename);
        next();

      });
    } else {
      next();
    }
    ;
  };

  q.push(lines, function(err) {
    err && logErr.error(err);
    err && debug && console.error(err);
  });

};

module.exports.main = main;

// Mode standalone
if (process.argv[2] === '--standalone') {
  main(process.argv[3]);
}
