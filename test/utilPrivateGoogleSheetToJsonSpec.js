'use strict';

var chai = require('chai')
  , Q = require('niceq')
  , util = require('../lib/util')
  , expect = chai.expect;

describe('util googleSheetToJson', function () {
  it('should return a json doc from private google spreadsheet', function (done) {
    this.timeout(10000);
    Q().
      niceThen(function (next) {
        util.googleSheetToJson({
          gdocKey: '0AilC0U4Eb0tjdDRObHlrTDMySms2d0dGZUhWQi10Wmc',
          sheetIndex: 1,
          googleAccount: {
            login: 'openhoat',
            password: process.env.GOOGLE_ACCOUNT_PASSWORD
          }
        }, next);
      }).
      then(function (result) {
        expect(result).to.be.ok;
        expect(result).to.be.instanceof(Array);
        expect(result).to.eql([
          {
            index: 1,
            action: 'init',
            param1: 'http://en.wikipedia.org'
          },
          {
            index: 2,
            action: 'visit',
            param1: '/wiki/Hello_world_program'
          },
          {
            index: 3,
            action: 'assertText',
            param1: '#firstHeading > span',
            param2: 'Hello world program'
          }
        ]);
      }).
      niceDone(done);
  });
});