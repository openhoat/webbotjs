'use strict';

var path = require('path')
  , soap = require('soap')
  , fs = require('fs')
  , WebBot = require('../lib/webbot')
  , specUtil = require('./spec-util')
  , logger = require('nice-logger').logger
  , baseDir;

baseDir = path.join(__dirname, '..');

describe('WebBot soap', function () {
  var baseDir;
  baseDir = path.join(__dirname, '..');
  before(function (done) {
    var myService, wsdl;
    myService = {
      StockQuoteService: {
        StockQuotePort: {
          GetLastTradePrice: function (args) {
            if (args.tickerSymbol === 'trigger error') {
              throw new Error('triggered server error');
            } else {
              return { price: 19.56 };
            }
          }
        }
      }
    };
    wsdl = fs.readFileSync(path.join(__dirname, 'stockquote.wsdl'), 'utf8');
    specUtil.startWebServer(function () {
      soap.listen(specUtil.httpServer, '/stockquote', myService, wsdl)/*.authenticate = function (security) {
        logger.info('security :', security);
        return true;
      }*/;
      done();
    });
  });
  after(function (done) {
    specUtil.stopWebServer(done);
  });
  it('should play a json soap test scenario', function (done) {
    var webBot, scenario = require('./soapScenario.json');

    function completed(err) {
      var elapsedTime = webBot.elapsedTime();
      logger.info('WebBotjs test took %s seconds', elapsedTime);
      done(err);
    }

    this.timeout(10000);
    webBot = new WebBot(baseDir);
    webBot.runStepsFromJsonScenario({ jsonScenario: scenario }, completed);
  });
});