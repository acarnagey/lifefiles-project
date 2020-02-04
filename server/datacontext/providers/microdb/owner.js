/*
OWNER SPECIFIC DATA ACCESS
*/


var
  util = require("util"),
  common = require("../../../common"),
  env = require('node-env-file'),
  permanent = require('permanent-api-js'),
  ownerItfc = require('../../interfaces/owner')
  ;

env('./envVars.txt');
var microdb = require('microdb-api')(process.env.MICRODB_APIKEY);

ownerItfc.getByAccountId = getByAccountId;
ownerItfc.saveProfile = saveProfile;
ownerItfc.saveDocument = saveDocument;
ownerItfc.getDocs = getDocs;
ownerItfc.getFile = getFile;
ownerItfc.getAll = getAll;
ownerItfc.addOwner = addOwner;
ownerItfc.getOwner = getOwner;

module.exports = ownerItfc;


function getByAccountId(id) {
  return new Promise(function (resolve) {
    microdb.Tables.owner.get({ 'accountid': id }).then(function (res) {
      var response = new common.response();
      if (!res.success) {
        response.message = 'error attempting to get by accountid';
        response.success = false;
      }
      else {
        response.user = res.data && res.data.Rows ? res.data.Rows : [];
        response.success = true;
      }
      resolve(response);
    });
  });
}


function saveProfile(data) {
  return new Promise(function (resolve) {
    data.Profile.primarykey = data.AccountInfo.primarykey;
    microdb.Tables.owner.saveUpdate(data.Profile).then(function (saveres) {
      var response = new common.response();
      response.success = true;
      if (saveres.success && saveres.data && saveres.data.updatedRows) {
        response.success = true;
      }
      else {
        response.success = false;
      }
      resolve(response);
    });
  });
}

function saveDocument(docreq) {
  return new Promise(function (resolve) {
    var response = new common.response();
    permanent.addFile(docreq.doc).then(function (saveres) {
      if (saveres.success && saveres.data) {
        var svdoc = {
          ownerid: docreq.ownerpk,
          documentname: docreq.doc.originalname,
          permanentarchivenumber: saveres.data.record.recordArchiveNumber,
        };

        microdb.Tables.ownerdocument.saveNew(svdoc).then(function (saveres) {
          if (saveres.success && saveres.data && saveres.data.addedRows) {
            response.success = true;
          }
          else {
            response.data = saveres.data;
            response.success = false;
          }
          resolve(response);
        });
      }
      else {
        response.success = false;
        resolve(response);
      }

    });

    
    //for saving to mypass database on microdb
    // var doc = {
    //   documentname: data.FileName,
    //   thefile: new microdb.File(data.fileInfo)
    // };
    // if (data.ownerkey > 0) {
    //   // is someone posting on owners behalf
    //   doc.ownerid = data.ownerkey; 
    // }
    // else {
    //   //is owner posting file
    //   doc.ownerid = data.User.AccountInfo.primarykey; 
    // }

    // microdb.Tables.ownerdocument.saveNew(doc).then(function (saveres) {
    //   if (saveres.success && saveres.data && saveres.data.addedRows) {
    //     response.success = true;
    //     response.addedRows = saveres.data.addedRows;
    //     response.originalname = saveres.data.originalname;
    //     response.filename = saveres.data.filename;
    //   }
    //   else {
    //     response.success = false;
    //   }
    //   resolve(response);
    // });


  });
}

function getDocs(data) {
  return new Promise(function (resolve) {
    var response = new common.response();

    microdb.Tables.ownerdocument.get(data).then(function (getres) {
      response.success = true;
      if (getres.success) {
        response.success = true;
        response.data = getres.data && getres.data.Rows ? getres.data.Rows : [];
      }
      else {
        response.success = false;
      }
      resolve(response);
    });
  });
}

function getFile(primarykey) {
  return new Promise(function (resolve) {
    var response = new common.response();
    // microdb.Tables.ownerdocument.getAttachment(data).then(function (getres) {
    //   response.success = true;
    //   if (getres.success) {
    //     response.success = true;
    //     response.data = getres.data;
    //   }
    //   else {
    //     response.success = false;
    //   }
    //   resolve(response);
    // });

    microdb.Tables.ownerdocument.get({ primarykey: primarykey }).then(function (getres) {
      response.success = true;
      if (getres.success) {
        // response.data = getres.data && getres.data.Rows ? getres.data.Rows : [];
        var archNum = getres.data.Rows[0].permanentarchivenumber;
        permanent.getFile({ archive_number: archNum }).then(function (permres) {
          if (!permres.success) {
            response.success = false;
          }
          else {
            response.data = permres.data.record;
            response.success = true;
          }
          resolve(response);
        });
      }
      else {
        response.success = false;
        resolve(response);
      }

    });

  });
}

function getAll() {
  return new Promise(function (resolve) {
    microdb.Tables.owner.get().then(function (res) {
      var response = new common.response();
      if (!res.success) {
        response.message = 'error attempting to get by all';
        response.success = false;
      }
      else {
        response.data = res.data && res.data.Rows ? res.data.Rows : [];
        response.success = true;
      }
      resolve(response);
    });
  });
}

function addOwner(data) {
  return new Promise(function (resolve) {
    var response = new common.response();

    //new way
    permanent.createArchive(data.Profile).then(function (permres) {
      if (!permres.success) {
        response.success = false;
        resolve(response);
        return;
      }
      else {
        data.Profile.permanent_archive_number = permres.data.archiveNbr;
        microdb.Tables.owner.saveNew(data.Profile).then(function (newres) {
          // if (upres.success) {
          // }
          // else {
          // }
          response.success = newres.success;
          resolve(response);
        });
      }
    });


    //old way
    // microdb.Tables.owner.saveNew(data.Profile).then(function (res) {
    //   if (res.success && res.data && res.data.addedRows) {
    //     response.data.insertId = res.data.addedRows[0].insertId;
    //     response.success = true;
    //     resolve(response);

    //     permanent.createArchive(data.Profile).then(function (permres) {
    //       if (permres.success) {
    //         var owner = {
    //           primarykey: response.data.insertId,
    //           permanent_archive_number: permres.data.pa_number
    //         };
    //         microdb.Tables.owner.saveUpdate(owner).then(function (upres) {
    //           // if (upres.success) {
    //           // }
    //           // else {
    //           // }
    //           response.success = upres.success;
    //           resolve(response);
    //         });
    //       }
    //     });
    //   }
    //   else {
    //     // var err = res.error;
    //     response.success = false;
    //     response.message = 'error adding Owner';
    //     resolve(response);
    //   }
    // });
  });
}


function getOwner(primarykey) {
  return new Promise(function (resolve) {
    var response = new common.response();
    microdb.Tables.owner.get({ "primarykey": primarykey }).then(function (res) {
      if (res.success && res.data && res.data.Rows.length > 0) {
        response.success = true;
        response.data.Owner = res.data.Rows[0];
        var docReq = {
          ownerid: primarykey
        };

        microdb.Tables.ownerdocument.get(docReq).then(function (getres) {
          response.data.Docs = getres.data && getres.data.Rows ? getres.data.Rows : [];
          resolve(response);
        });

        //if needed get archive info from permanent
        // if (!response.data.Owner.permanent_archive_number) {
        //   var permreq={
        //     archive_number:response.data.Owner.permanent_archive_number
        //   };
        //   permanent.getArchive(permreq).then(function (permres) {
        //     var dddd=permres;
        //   });
        // }


      }
      else {
        // var err = res.error;
        response.success = false;
        response.message = 'Owner not found';
        resolve(response);
      }

    });
  });
}