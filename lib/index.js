'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CHAIN_API = exports.CALL_API = undefined;

var _superagent = require('superagent');

var _superagent2 = _interopRequireDefault(_superagent);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _humps = require('humps');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var CALL_API = exports.CALL_API = Symbol('CALL_API');
var CHAIN_API = exports.CHAIN_API = Symbol('CHAIN_API');

var defaultInterceptor = function defaultInterceptor(_ref) {
  var proceedError = _ref.proceedError;
  var err = _ref.err;
  var replay = _ref.replay;
  var getState = _ref.getState;

  proceedError();
};

exports.default = function (_ref2) {
  var _ref2$errorIntercepto = _ref2.errorInterceptor;
  var errorInterceptor = _ref2$errorIntercepto === undefined ? defaultInterceptor : _ref2$errorIntercepto;
  var baseUrl = _ref2.baseUrl;

  var extractParams = paramsExtractor({ baseUrl: baseUrl });

  return function (_ref3) {
    var dispatch = _ref3.dispatch;
    var getState = _ref3.getState;
    return function (next) {
      return function (action) {
        if (action[CALL_API]) {
          return dispatch(_defineProperty({}, CHAIN_API, [function () {
            return action;
          }]));
        }

        return new _bluebird2.default(function (resolve, reject) {
          if (!action[CHAIN_API]) {
            return next(action);
          }

          var promiseCreators = action[CHAIN_API].map(function (createCallApiAction) {
            return createRequestPromise({
              createCallApiAction: createCallApiAction,
              getState: getState,
              dispatch: dispatch,
              errorInterceptor: errorInterceptor,
              extractParams: extractParams
            });
          });

          var overall = promiseCreators.reduce(function (promise, createReqPromise) {
            return promise.then(function (body) {
              return createReqPromise(body);
            });
          }, _bluebird2.default.resolve());

          overall.finally(function () {
            resolve();
          }).catch(function () {});
        });
      };
    };
  };
};

function actionWith(action, toMerge) {
  var ac = _lodash2.default.cloneDeep(action);
  if (ac[CALL_API]) {
    delete ac[CALL_API];
  }
  return _lodash2.default.merge(ac, toMerge);
}

function createRequestPromise(_ref4) {
  var createCallApiAction = _ref4.createCallApiAction;
  var getState = _ref4.getState;
  var dispatch = _ref4.dispatch;
  var errorInterceptor = _ref4.errorInterceptor;
  var extractParams = _ref4.extractParams;

  return function (prevBody) {

    var apiAction = createCallApiAction(prevBody);
    var params = extractParams(apiAction[CALL_API]);

    return new _bluebird2.default(function (resolve, reject) {
      function sendRequest() {
        if (params.sendingType) {
          dispatch(actionWith(apiAction, { type: params.sendingType }));
        }
        _superagent2.default[params.method](params.url).send(params.body).query(params.query).end(function (err, res) {
          function proceedError() {
            handleError(err);
          }
          if (err) {
            errorInterceptor({
              proceedError: proceedError,
              err: err,
              getState: getState,
              replay: sendRequest
            });
          } else {
            var resBody = (0, _humps.camelizeKeys)(res.body);
            dispatchSuccessType(resBody);
            processAfterSuccess();
            resolve(resBody);
          }
        });
      }
      sendRequest();

      function handleError(err) {
        dispatchErrorType(err);
        processAfterError();
        reject();
      }

      function dispatchErrorType(err) {
        if (params.errorType) {
          dispatch(actionWith(apiAction, {
            type: params.errorType,
            error: err
          }));
        }
      }
      function processAfterError() {
        if (_lodash2.default.isFunction(params.afterError)) {
          params.afterError({ getState: getState });
        }
      }
      function dispatchSuccessType(resBody) {
        dispatch(actionWith(apiAction, {
          type: params.successType,
          response: resBody
        }));
      }
      function processAfterSuccess() {
        if (_lodash2.default.isFunction(params.afterSuccess)) {
          params.afterSuccess({ getState: getState, dispatch: dispatch });
        }
      }
    });
  };
}

function paramsExtractor(_ref5) {
  var baseUrl = _ref5.baseUrl;

  return function (callApi) {
    var method = callApi.method;
    var path = callApi.path;
    var query = callApi.query;
    var body = callApi.body;
    var url = callApi.url;
    var successType = callApi.successType;
    var sendingType = callApi.sendingType;
    var errorType = callApi.errorType;
    var afterSuccess = callApi.afterSuccess;
    var afterError = callApi.afterError;


    url = url || '' + baseUrl + path;

    return {
      method: method,
      url: url,
      query: query,
      body: body,
      successType: successType,
      sendingType: sendingType,
      errorType: errorType,
      afterSuccess: afterSuccess,
      afterError: afterError
    };
  };
}