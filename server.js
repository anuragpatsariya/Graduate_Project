var express = require("express");
var app = express();
var shortId = require("shortid");
var assert = require("assert");
var multer = require("multer");
var formidable = require("formidable");
var util = require("util");
var fs = require('fs');
var mongoose = require('mongoose');
var mongo = require("mongodb");
var Grid = require("gridfs-stream");
var Schema = mongoose.Schema;
var bodyParser = require("body-parser");
var session = require("express-session");

var MongoClient = mongo.MongoClient;
var photo_dburl = "mongodb://localhost:27017/photo_data";
var photo_storage_url = "mongodb://localhost:27017/photo_storage_db";
var abs_file_name;
app.use(express.static("."));
app.use(express.static(__dirname + '/css'));
app.use(express.static(__dirname + '/js'));
app.use(express.static(__dirname + '/node_module'));
app.use(express.static(__dirname + '/js'));
app.use(bodyParser.json());
app.use(session({secret:"sh",cookie:{maxAge:5*60*1000}}));

app.get('/', function (req, res) {
    app.use(express.static(__dirname + '/'));
    res.sendFile(__dirname + "/index.html");
});

//------------ IMAGE UPLOAD--------------------//
var data_file;
app.post("/upload", function (req, res) {
    var form = new formidable.IncomingForm();
    form.uploadDir = __dirname + '/uploads';
    //file upload path
    form.parse(req, function (err, fields, files) {
        //you can get fields here
        console.log(fields);

    });
    form.on('fileBegin', function (name, file) {
        file.path = form.uploadDir + "/" + file.name;
        console.log("File: ", file);
        data_file = file;
        //modify file path
    });
    form.on('end', function () {
        //res.sendStatus(200);
        mongoose.connect('mongodb://localhost:27017/file_storage');
        var conn = mongoose.connection;
        Grid.mongo = mongoose.mongo;
        conn.once('open', function () {
            console.log('Open');
            var gfs = Grid(conn.db);
            var writestream = gfs.createWriteStream({
                filename: data_file.name
            });
            fs.createReadStream(__dirname + '/uploads/' + data_file.name).pipe(writestream);
            writestream.on('close', function (file) {
                console.log(file.filename + ' Written to DB');
                conn.close();
            });
        });
        //conn.close();
        console.log("File uploaded.");
        res.send(data_file.name);
        //when finish all process    
    });
    //res.send(data_file.name);
});

//--------------------------------------------------//
var count = 0;
app.post("/getphoto", function (req, res) {
    var photo_name = req.body;
    MongoClient.connect('mongodb://localhost:27017/file_storage', function (err, db) {
        if (err) {
            console.log("Unable to connect.");
        } else {

            var conn = mongoose.connection;
            Grid.mongo = mongoose.mongo;
            conn.once('open', function () {
                console.log('Open');
                var gfs = Grid(conn.db);

                var fs_write_stream = fs.createWriteStream('write' + count);

                //read from mongodb
                var readstream = gfs.createReadStream({
                    filename: photo_name
                });
                readstream.pipe(fs_write_stream);
                fs_write_stream.on('close', function () {
                    console.log('file has been written fully!');
                    count++;
                    //conn.close();
                });
            });
        }
    });
    // mongoose.connect('mongodb://localhost:27017/file_storage');
    // var conn = mongoose.connection;
    // Grid.mongo = mongoose.mongo;
    // conn.once('open', function () {
    //     console.log('Open');
    //     var gfs = Grid(conn.db);

    //     var fs_write_stream = fs.createWriteStream('write'+count);

    //     //read from mongodb
    //     var readstream = gfs.createReadStream({
    //         filename: photo_name
    //     });
    //     readstream.pipe(fs_write_stream);
    //     fs_write_stream.on('close', function () {
    //         console.log('file has been written fully!');
    //         count++;
    //         conn.close();
    //     });
    // });
});

//---------register a user---------//
app.post("/register", function (req, res) {
    var new_uname = req.body.username;
    var new_pwd = req.body.password;
    var doc = {"username":new_uname,"password":new_pwd};
    var collection;
    MongoClient.connect("mongodb://localhost:27017/user_data", function (err, db) {
        if (err) {
            console.log("Unable to register new user.");
        } else {
            console.log("connected to register a new user.");
            collection = db.collection("user_data");
            collection.find({ "username": new_uname }).toArray(function (err, result) {
                if (err) {
                    console.log("DB error.");
                } else {
                    console.log(result[0]);
                    if (result[0] != null) {
                        console.log("User already exists.");
                        res.send("user_exist");
                    } else {
                        collection.insert(doc, { w: 1 }, function (err, record) {
                            console.log(record);
                            res.send(record.ops[0]);
                        });
                    }
                }
            });
        }
    });
});

var sess;
//-----Verify user: USER LOGIN----//
app.post("/verifyuser", function (req, res) {
    var sess = req.session;
    var uname = req.body.uname;
    var pwd = req.body.pwd;
    var collection;
    MongoClient.connect("mongodb://localhost:27017/user_data", function (err, db) {
        if (err) {
            console.log("Unable to connect for login.");
        } else {
            console.log("Connected for login verification.");
            collection = db.collection("user_data");
            collection.find({ "username": uname, "password": pwd }).toArray(function (err, result) {
                if (err) {
                    console.log("Db error");
                    res.send(err);
                } else {
                    console.log(result);
                    //console.log(result.body.username, result.body.passwprd);
                    if (result[0] != null) {
                        console.log("Login Successful.");
                        sess.user = result[0];
                        g_uname = result[0].username;
                        res.send(result[0]);
                    } else {
                        console.log("Incorrect username or password.");
                        res.send("failure");
                    }

                    //res.send(result);
                }
            });
        }
    });
});


app.post("/logout", function (req, res) {
    //g_uname = null;
    req.session.destroy(function (err) {
        if (err) {
            console.log(err);
        } else {
            res.redirect('/');
        }
    });
    //res.send("username set to NULL");
    
});

app.post("/deleteRecord", function (req, res) {
    var photo_name = req.body.photo_name;
    console.log(photo_name);
    var collection;
    MongoClient.connect(photo_dburl, function (err, db) {
        if (err) {
            console.log("Unable to connect.");
        } else {
            console.log("Connected to Delete.");
            collection = db.collection("photo_data");
            collection.findAndModify(
                { "photo": photo_name },
                [],
                { $set: { "deleted": "true" } },
                {},
                function (err, object) {
                    if (err) {
                        console.log(err);
                    } else {
                        console.log("Record deleted.");
                        res.send("object");
                    }
                });
        }
    });
});
//----------------- RECORD UPLOAD ---------------------//

app.post("/uploadRecord", function (req, res) {
    var doc = req.body;
    console.log(doc);
    var collection;
    MongoClient.connect(photo_dburl, function (err, db) {
        if (err) {
            console.log("Unable to connect.");
        } else {
            console.log("Connected to insert.");
            collection = db.collection("photo_data");
            collection.insert(doc, { w: 1 }, function (err, record) {
                console.log(record);
                res.send(record.ops[0]);
            });
        }
    });

});

//-------------------------------------------------------//

app.get("/api/photos_data", function (req, res) {
    sess = req.session;
    var collection;
    MongoClient.connect(photo_dburl, function (err, db) {
        if (err) {
            console.log("Unable to connect to DB.", err);
        } else {
            console.log("Connected.");
            collection = db.collection("photo_data");
            if (sess.user  === undefined) {
                collection.find({ "deleted": "false" }).toArray(function (err, result) {
                    if (err) {
                        res.send(err);
                    } else {
                        console.log(result);
                        res.send(result);
                    }
                });
            }
            if (sess.user && sess.user.username != undefined) {
                collection.find({ "deleted": "false", "user": sess.user.username }).toArray(function (err, result) {
                    if (err) {
                        res.send(err);
                    } else {
                        console.log(result);
                        res.send(result);
                    }
                });
            }
        }
    });
});


//Forever alone yet important code ;)
app.listen(5000, function () {
    console.log("Working on port 5000");
});