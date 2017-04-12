/*global module, process, err, require, __dirname, e */
/*jslint node: true */
/*jslint indent: 2 */
'use strict';
/*
 * Module qui effectue les écoutes sur les événements générés par REDIS.
 * La gestion de la parallélisation est effectuée en mode cluster.
 * Le nombre max de jobs en // est modifiable à la volée grâce au fichier ..../$SESSION/$MODULE/maxWorkersFile
 */

// workaround pour jsLint
module.exports = "fork";

var cluster        = require('cluster')
  , fs             = require('fs')
  , config         = require(__dirname + '/config.js')
  , _              = require('lodash')
  , redis          = require('redis')
  , business       = require(config.getBusinessModule())
  , redisPort      = process.env.REDIS_PORT || 6379
  , redisHost      = process.env.REDIS_HOST || 'localhost'
  , redisClient    = redis.createClient({'host': redisHost, 'port': redisPort})
  , subscriber     = redis.createClient({'host': redisHost, 'port': redisPort})
  , sessionName    = process.env.ISTEX_SESSION
  , redisKey       = sessionName + ':' + process.env.MODULENAME
  , outChannelName = redisKey + ':out'
  , errChannelName = redisKey + ':err'
  , inChannelName  = redisKey + ':in'
  ;

var maxWorkersFile    = process.env.DIR_SESSIONS + '/' + process.env.ISTEX_SESSION + '/maxWorkers';
var Log               = require('log');
var log               = new Log('info', fs.createWriteStream(process.env.LOGFILE, {
  flags: 'a'
}));
var logErr            = new Log('error', fs.createWriteStream(process.env.LOGFILEERR, {
  flags: 'a'
}));
// on créé autant de forks que de cpus
var maxWorkers        = require('os').cpus().length / 2;
// pile de fichiers json en attente de traitement
var jsonToProcess     = [];
// variable contenant les JSON qu'on extrait de la pile.
var unstackedJsonFile = null;
/**
 * Méthode qui créé un fork avec le nom du fichier JSON en paramètre ainsi que sont path complet
 */
var forkWorker        = function(jsonFile) {
  var worker = cluster.fork({
                              basename     : jsonFile,
                              CHEMINCOMPLET: process.env.DIR_IN + '/TEST_1970-01-01-00-00-00/a/0/f/' + jsonFile
                            });
  // on ajoute au worker une propriété permettant de stocker le nom du fichier traité
  // => utile pour la partie 'exit'
  worker.currentJson = jsonFile;
  log.debug('worker ' + worker.currentJson + ' forked (' + jsonFile + ')');
  return worker;
};

/**
 * Méthode qui créé autant de fork que possible, sans dépasser le nb fixé par le param maxWorkers
 */
var forkAsWorkersAsPossible = function() {
  while(jsonToProcess.length > 0 && _.size(cluster.workers) < maxWorkers) {
    unstackedJsonFile = jsonToProcess.splice(0, 1)[0];
    forkWorker(unstackedJsonFile);
  }
}

var forceKillForks = function() {
  for (var id in cluster.workers) {
    if (cluster.workers.hasOwnProperty(id)) {
      cluster.workers[id].kill();
    }
  }
};

var liModule = require('./li-module.js');

if (cluster.isMaster) {
  if (business.beforeAnyJob) {

    business.beforeAnyJob(function(err, options) {
      if (err) {
        logErr.error(`Problème lors de la création de l'index Elasticsearch pour la session ${process.env.ISTEX_SESSION}`);
        //Todo:faire process.kill(-maestro.pid)
      } else {
        log.info(`l'index Elasticsearch pour la session ${process.env.ISTEX_SESSION} a bien été créé.`);
      }

      if (options) {
        options.errLogs && options.errLogs.forEach(function(_log) {
          logErr.error(_log);
        });
        options.processLogs && options.processLogs.forEach(function(_log) {
          log.info(_log);
        });
      }
      masterProcess();
    });
  } else {
    masterProcess();
  }
} else {
// Fork
  liModule.main(process.env.basename);
}

function masterProcess () {
  log.debug('Création du master...');

  redisClient.publish('li:module:start',
                      JSON.stringify({session: process.env.ISTEX_SESSION, module: process.env.MODULENAME}));
  redisClient.del('Module:' + redisKey);
  redisClient.hmset('Module:' + redisKey,
                    'name',
                    process.env.MODULENAME,
                    'sessionName',
                    process.env.ISTEX_SESSION,
                    'in',
                    0,
                    'out',
                    0,
                    'err',
                    0);

  // on stocke ce paramètre dans le fichier de conf correspondant => pourra être changé à la volée
  if (!fs.existsSync(maxWorkersFile)) {
    fs.writeFileSync(maxWorkersFile, '' + maxWorkers, {
      flag    : 'w',
      encoding: 'utf8'
    });
  }

  // timer permettant de mettre à jour maxWorkers en lisant un fichier de conf toutes les 5 secondes
  setInterval(function() {
    var max = fs.readFileSync(maxWorkersFile, {
      encoding: 'utf8'
    });
    if (!max) {
      logErr.error('Problème dans la lecture du fichier ' + maxWorkersFile);
    } else {
      max = parseInt(max, 10);
      if (isNaN(max) || max < 1 || max > 500) {
        logErr.error('valeur contenue dans ' + maxWorkersFile + 'incorrecte (doit être un entier compris entre 1 et 500)');
      } else {
        maxWorkers = max;
        log.info('cluster.workers_size' + _.size(cluster.workers) + ', maxWorkers=' + maxWorkers + ', jsonToProcess.length=' + jsonToProcess.length);
      }
    }
    //dans tous les cas, on relance autant de forks que possible (utile dans le cas où des forks ne sont pas terminés normalement)
    forkAsWorkersAsPossible();
  }, 5000);

  log.debug('Channels : ', inChannelName, outChannelName);
  // Un client subscriber n'est pas supposé s'occuper d'autres commandes.
  subscriber.subscribe(inChannelName);
  // on écoute les message sur le channel in
  subscriber.on('message', function(channel, message) {

    if (channel === inChannelName) {
      //si on reçoit du maestro un message kill, on s'arrête
      if (message === 'kill') {
        forceKillForks();
        redisClient.publish(inChannelName, 'killed');
        process.exit(0);
      } else {
        redisClient.hincrby('Module:' + redisKey, 'in', 1);
        //si on a de la place dans la pile on fork, sinon on empile
        if (_.size(cluster.workers) < maxWorkers) {
          forkWorker(message);
        } else {
          jsonToProcess.push(message);
        }
      }
    }
  });
  // on surveille l'arrêt des processus fils
  cluster.on('exit', function(worker, code, signal) {

    log.info('Worker ' + worker.process.pid + ' (' + worker.currentJson + ') terminé, on dépile et démarre un nouveau traitement');
    if (code !== 0) {
      logErr.error('Erreur dans l\'exécution du worker ' + worker.process.pid + ' : il s\'est arrêté avec le code ' + code);
    } else {
      // si le fork s'est terminé normalement, on émet l'event de fin de traitement sur le channel out
      // (la copie tmp -> out est faite dans li-module.js)
      log.debug('worker ' + worker.currentJson + ' finished');
      redisClient.hincrby('Module:' + redisKey, 'in', -1);
      var jsonOutFile = process.env.DIR_OUT + '/' + process.env.ISTEX_SESSION + '/' + worker.currentJson[0] + '/' + worker.currentJson[1] + '/' + worker.currentJson[2] + '/' + worker.currentJson;
      if (fs.existsSync(jsonOutFile)) {

        redisClient.hincrby('Module:' + redisKey, 'out', 1);
        redisClient.publish(outChannelName, worker.currentJson);
      }

      var jsonErrFile = process.env.DIR_ERR + '/' + process.env.ISTEX_SESSION + '/' + worker.currentJson[0] + '/' + worker.currentJson[1] + '/' + worker.currentJson[2] + '/' + worker.currentJson;
      if (fs.existsSync(jsonErrFile)) {
        redisClient.hincrby('Module:' + redisKey, 'err', 1);
        redisClient.publish(errChannelName, worker.currentJson);
      }
    }
    worker.kill();
    forkAsWorkersAsPossible();

  });


  // le module s'est correctement initialisé, on écrit la valeur '1' dans le fichier ready
  var sessionDir = process.env.DIR_SESSIONS + '/' + process.env.ISTEX_SESSION;
  fs.writeFileSync(sessionDir + '/ready', '1', {
    encoding: 'utf8'
  });
  console.log(process.env.MODULENAME + ' running as a daemon [ hit CTRL+C to stop ]');
}
