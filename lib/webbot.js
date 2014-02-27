var util = require('./util')
  , log4js = require('log4js')
  , Q = require('q')
  , Browser = require('zombie')
  , request = require('request')
  , defaultConfig = require('./default-config');

function WebBot(baseDir, configDir, defaultConfigName) {
  var that;
  that = this;
  that.initialized = false;
  that.config = WebBot.loadConfig(baseDir, configDir, defaultConfigName);
  that.logger = that.config.logger;
  that.actions = {};
  that.initialized = false;
}

WebBot.loadConfig = function (baseDir, configDir, defaultConfigName) {
  var args, config;
  args = util.parseArgs(arguments, [
    { name: 'baseDir', optional: true, type: 'string'},
    { name: 'configDir', optional: true, type: 'string'},
    { name: 'defaultConfigName', optional: true, type: 'string'}
  ]);
  config = util.copyProperties(defaultConfig);
  util.copyProperties(util.loadConfig(args.configDir, args.defaultConfigName, 2, args.baseDir), config, false);
  config = util.configToAbsolutePaths(config, config.baseDir);
  config.logger = log4js.getLogger('webbot');
  if (config.log['level']) {
    config.logger.setLevel(config.log['level']);
  }
  return config;
};

WebBot.prototype.util = WebBot.util = util;

WebBot.prototype.init = function (callback) {
  var that, key;
  that = this;
  Q().
    then(function () {
      var asyncInit, inits = [];
      asyncInit = function (action) {
        var deferred = Q.defer();
        action.init(that, deferred.makeNodeResolver());
        return deferred.promise;
      };
      for (key in that.config.actions) {
        var action;
        action = require(that.config.actions[key]);
        that.actions[key] = action;
        if (typeof action.init === 'function') {
          inits.push(asyncInit(action));
        }
      }
      return inits;
    }).
    all().
    then(function () {
      that.initialized = true;
      callback();
    }).
    catch(callback);
};

WebBot.prototype.addAction = function (name, file) {
  var that;
  that = this;
  that.config.actions[name] = file;
};

WebBot.prototype.buildScenarioFromJson = function (jsonDoc, callback) {
  var that, i, item, action, step;
  that = this;
  that.browser = new Browser();
  that.steps = [];
  for (i = 0; i < jsonDoc.length; i++) {
    item = jsonDoc[i];
    item.index = item.index || (i + 1);
    step = null;
    action = that.actions[item.action];
    if (action && typeof action.build === 'function') {
      that.steps.push(action.build(that, item));
    } else {
      throw util.format("Unknown action '%s' in #%s!", item.action, item.index);
    }
  }
  callback(null);
};

WebBot.prototype.buildScenarioFromGoogleDoc = function (options, callback) {
  var that = this;
  Q().
    then(function () {
      var deferred = Q.defer();
      util.googleSheetToJson(options, deferred.makeNodeResolver());
      return deferred.promise;
    }).
    then(function (jsonDoc) {
      that.buildScenarioFromJson(jsonDoc, callback);
    }).
    catch(callback);
};

WebBot.prototype.runSteps = function (callback) {
  var that
    , nextPromise;
  that = this;
  nextPromise = Q();
  that.startTime = process.hrtime();
  that.steps.forEach(function (step) {
    nextPromise = nextPromise.then(step);
  });
  nextPromise.
    then(callback).
    catch(callback);
  return nextPromise;
};

WebBot.prototype.elapsedTime = function () {
  return process.hrtime(this.startTime);
};

WebBot.prototype.elapsedTimeMs = function () {
  var elapsed, elapsedMs;
  elapsed = this.elapsedTime();
  elapsedMs = parseInt((elapsed[0] * 1E9 + elapsed[1]) / 1E6, 10);
  return elapsedMs;
};

WebBot.prototype.runStepsFromGdocScenario = function (options, callback) {
  var that;
  that = this;
  Q().
    then(function () {
      var deferred = Q.defer();
      if (that.initialized) {
        deferred.resolve();
      } else {
        that.init(deferred.makeNodeResolver());
      }
      return deferred.promise;
    }).
    then(function () {
      var deferred = Q.defer();
      that.buildScenarioFromGoogleDoc(options, deferred.makeNodeResolver());
      return deferred.promise;
    }).
    then(function () {
      var deferred = Q.defer();
      that.runSteps(deferred.makeNodeResolver());
      return deferred.promise;
    }).
    then(callback).
    catch(callback);
};

WebBot.prototype.runStepsFromJsonScenario = function (jsonWebScenario, callback) {
  var that;
  that = this;
  Q().
    then(function () {
      var deferred = Q.defer();
      if (that.initialized) {
        deferred.resolve();
      } else {
        that.init(deferred.makeNodeResolver());
      }
      return deferred.promise;
    }).
    then(function () {
      var deferred = Q.defer();
      that.buildScenarioFromJson(jsonWebScenario, deferred.makeNodeResolver());
      return deferred.promise;
    }).
    then(function () {
      var deferred = Q.defer();
      that.runSteps(deferred.makeNodeResolver());
      return deferred.promise;
    }).
    then(callback).
    catch(callback);
};

WebBot.prototype.runStepsFromDlJsonScenario = function (scenarioUrl, callback) {
  var that;
  that = this;
  Q().
    then(function () {
      var deferred = Q.defer();
      request({ method: 'GET', uri: scenarioUrl }, deferred.makeNodeResolver());
      return deferred.promise;
    }).
    spread(function (res, body) {
      var deferred = Q.defer();
      if (res.statusCode !== 200) {
        throw new Error(res.statusCode);
      }
      that.runStepsFromJsonScenario(JSON.parse(body), deferred.makeNodeResolver());
      return deferred.promise;
    }).
    then(callback).
    catch(callback);
};

module.exports = WebBot;