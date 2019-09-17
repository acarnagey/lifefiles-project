'use strict';
var
  util = require("util"),
  eventEmitter = require('events').EventEmitter,
  env = require('node-env-file')
  ;

var Singleton = (function (apikey, opts) {
  var instance;
  //take out  env = require('node-env-file')  for release to public as they dont need it
  //they must always use https
  env('./envVars.txt');
  var httpService;
  if (process.env.NODE_ENV == 'local') {
    httpService = require('http');
  }
  else {
    httpService = require('https');
  }

  function Microdb(apikey, opts) {
    opts = opts || {};
    var env = opts.env || process.env;
    if (!apikey) {
      throw 'API_KEY is required';
    }

    var app_instance = this;
    var VERSION = '1.0.0';
    var _API_KEY = apikey;
    var _STATUS = 'ok';
    var host = '127.0.0.1';
    var port = '9001';
    var handlers = {
      onLoaded: null
    };
    var _DbId;
    var mdbevents = {
      'InitFailed': 'mdb.InitFailed'
    };

    // this.getTables = getTables;
    this.describeTables = describeTables;
    this.Events = mdbevents;
    this.Init = false;
    this.Tables = {};

    function init() {
      getTables().then(function (gtRes) {
        if (!gtRes.success) {
          app_instance.emit(mdbevents.InitFailed, 'empty args');
        }
        else {
          app_instance.Init = true;
        }
      });
    }

    function getTables() {
      return postMsg('tables/describe', {}).then(genSchema);
    }

    function describeTables() {
      return new Promise((resolve) => {
        var tables = [];
        var keys = Object.keys(app_instance.Tables);
        for (var index = 0; index < keys.length; index++) {
          var tblname = keys[index];
          const element = app_instance.Tables[tblname];
          tables.push(
            {
              name: element.Name,
              columns: element.ColumnHeaders
            });
        }
        resolve(tables);
      });

    }

    function postMsg(route, msg) {

      if (!_API_KEY) {
        throw 'API_KEY is required';
      }
      return new Promise((resolve) => {
        var clientResponse = new Response();
        var contentType = "application/json;charset=UTF-8";
        var segments = [];
        var Request = {
          'data': msg,
          'apiKey': _API_KEY,
        };

        var options = {
          hostname: host,
          port: port,
          path: '/' + route,
          method: 'POST',
          headers: {
            'Content-Type': contentType,
            'Content-Length': Buffer.byteLength(JSON.stringify(Request))
          }
        };

        if (_STATUS == 'suspended') {
          clientResponse.message = 'account suspended';
          clientResponse.success = false;
          resolve(clientResponse);
        }

        var req = httpService.request(options, (httpRes) => {
          httpRes.setEncoding('utf8');
          httpRes.on('data', (responseData) => {
            if (httpRes.statusCode === 200) {
              clientResponse.data += responseData;
            }
            else {
              clientResponse.httpcode = httpRes.statusCode;
              _STATUS = 'suspended';
              clientResponse.success = false;
              resolve(clientResponse);
            }
          });
          httpRes.on('end', () => {
            if (clientResponse.data) {
              var resObj = JSON.parse(clientResponse.data);
              clientResponse.message = resObj.message;
              clientResponse.success = resObj.success;
              clientResponse.data = resObj.data;
            }
            resolve(clientResponse);
          })
        });

        req.on('error', (e) => {
          clientResponse.success = false;
          resolve(clientResponse);
        });
        // write data to request body
        req.write(JSON.stringify(Request));
        req.end();

      });
    }

    function genSchema(res) {
      return new Promise((resolve) => {
        if (!res.success) {
          resolve(res);
          return;
        }
        if (res.data.Tables) {
          res.data.Tables.forEach(element => {
            var tblName = scrubTableName(element.Name);
            Object.defineProperty(app_instance.Tables, tblName, {
              value: new Table(element),
              enumerable: true,
              configurable: false
            });
          });
        }

        resolve(res);
        return;
      });
    }

    function scrubTableName(name) {
      return name.toLowerCase().replace(/[^a-zA-Z0-9]/gi, ''); //removes all non-alphanumeric
    }

    function Table(tbl_schema) {
      var __schema = tbl_schema;
      var __table = this;

      this.Id = __schema.Id;
      this.Name = scrubTableName(__schema.Name);
      this.CreateDate = __schema.CreateDate;
      this.CreatedBy = __schema.CreatedBy;
      this.Imported = __schema.Imported;
      this.UpdateDate = __schema.UpdateDate;
      this.UpdatedBy = __schema.UpdatedBy;
      this.ColumnHeaders = [];
      this.save = savetable;
      this.addRow = addRow;
      this.get = getTableData;

      __schema.Columns.forEach(function (col) {
        __table.ColumnHeaders.push(new ColumnHeader(col));
      });

      function addRow() {
        var row = new TableRow(__schema.Columns);
        row.IsNew = true;
        return row;
      }

      function savetable(row) {
        var sendrows = [];
        if (row.IsNew) {
          sendrows.push(row);
        }
        else if (row.IsUpdate) {
          sendrows.push(row);
        }
        else if (row.IsDelete) {
          sendrows.push(row);
        }
        return saveTableData(this.Id, sendrows);
      }

      function getTableData(data) {
        var req = {
          DbId: _DbId,
          TblId: __table.Id,
          query: data
        };
        return postMsg('data/get', req);
      }

      function saveTableData(tblid, data) {
        var req = {
          DbId: _DbId,
          TblId: tblid,
          data: data
        };
        return postMsg('data/save', req);
      }

    }

    function TableRow(columns) {
      var thisrow = this;
      //    this.Columns = [];
      columns.forEach(function (col) {
        // var c = new Column(col);
        var name = col.Label.toLowerCase().replace(' ', '_');
        Object.defineProperty(thisrow, name, {
          value: new Column(col),
          enumerable: true,
          configurable: false
        });
      });
      return this;
    }

    function ColumnHeader(col) {
      var __col = col;
      

      //need to simplify the columns to a standard format so thres no confusion
      this.Name = col.Label;
      this.FormattedName = col.Label.toLowerCase().replace(' ', '_');

      this.Value = col.Value || '';
      this.DataType = col.DataType;
      this.DisplayOrder = col.DisplayOrder;
      this.Id = col.Id;
      this.Length = col.Length;
      this.NotNull = col.NotNull;
      this.VirtualTypeId = col.VirtualTypeId;
      
      return this;
    }

    function Column(col) {
      var thisCol = this;
      var __col = col;
      // this.Name = col.Label;
      this.Value = col.Value || '';
      // this.Id = col.Id;
      // this.ColKey = col.ColKey;

      // this.DisplayOrder = col.DisplayOrder;
      // this.DataType=col.DataType;
      // this.Length=col.Length;
      // this.NotNull=col.NotNull;
      // this.TimeTracking=col.TimeTracking;
      // this.VirtualTypeId=col.VirtualTypeId;
      // this.config=col.config;
      // this.getId = getId;
      // function getId() {
      //   return _Id;
      // }

      return this;
    }

    function Response(response) {
      this.success;
      this.error;
      this.message = '';
      this.data = '';

      if (response) {
        this.success = response.success;
        this.error = response.error;
      }
    }

    init();
  }

  util.inherits(Microdb, eventEmitter);


  function createInstance(apikey, opts) {
    var object = new Microdb(apikey, opts);
    return object;
  }

  return {
    getInstance: function (apikey, opts) {
      if (!instance) {
        instance = createInstance(apikey, opts);
      }
      return instance;
    }
  };
})();

module.exports = Singleton;