#!/usr/bin/env nodejs
const aws = require('aws-sdk');
const express = require('express');
const compression = require('compression');
const http = require('http');
const uuid4 = require('uuid/v4');
const fs = require('fs');
const path = require('path');
const multer = require("multer");
const multerS3 = require("multer-s3");
const bodyParser = require('body-parser');
const config = require('./config.json');

aws.config.update({region: config.region});
const app = new express();
const s3 = new aws.S3();

function FileValidation(ext) {
    const validfiles = ['png', 'jpg', 'jpeg', 'gif'];
    return validfiles.some((element, index, array) => {
        return element === ext;
    });
}

const storage = multerS3({
    s3: s3,
    bucket: config.bucket,
    acl: "public-read",
    metadata: function(req, file, cb) {
        cb(null, {fieldName: file.fieldname});
    },
    key: function(req, file, cb) {
        let filename_noext = uuid4().replace(/-/g, "").substring(0,2) + Date.now();
        let ext = file.mimetype.split('/')[1];
        let filename = filename_noext + "." + ext;
        cb(null, filename);
    }
})

const upload = multer({
    storage: storage,
    limits: {fileSize: 100000000},
    fileFilter: function(req, file, cb) {
        let ext = file.mimetype.split('/')[1];
        if (FileValidation(ext)) {
            cb(null, true);
        }
        else {
            cb(new Error("Only images are allowed"));
        }
    }
})

app.use(compression());
app.use(bodyParser.urlencoded({extended: false, limit: "100mb"}));
app.use(bodyParser.json({limit: "100mb"}));
app.use(bodyParser.text({limit: "100mb"}));
app.use('/static', express.static(path.join(__dirname, "static")));
app.set('views', path.join(__dirname, "views"));
app.set('view engine', 'ejs');

app.use((req, res, next) => {
    console.log("Requested Path: " + `${req.path}`);
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log("Users IP: " + ip);
    next();
});

app.use("/image/:image", (req, res, next) => {
    if (!req.params.image) {
        res.status(400).send("Invalid file");
    } else {
        let img = {};
        img.name = req.params.image;
        s3.getObject({Bucket: config.bucket, Key: req.params.image}, function(err, data) {
            if (err) {
                img.image = config.coldstore + "/" + req.params.image
            } else {
                img.image = "https://s3.amazonaws.com/"+ config.bucket + "/" + req.params.image
            }
            res.render("image", img);
        })
    }
});

app.post("/upload", upload.single('image'), (req, res, next) => {
    res.send('/image/' + req.file.key)
});

function startServer() {
    // Creates unix socket
    fs.unlink("./imageserver.sock", (error) => {
        let server = http.createServer(app);
        server.listen("./imageserver.sock");
        server.on('listening', onListening);
        function onListening() {
            fs.chmodSync('./imageserver.sock', '775');
            console.log("Started unix socked");
        };
        // Deletes socket file
        function servershutdown () {
            server.close();
        }
        process.on('SIGINT', servershutdown);
    });
}

if (require.main === module) {
    startServer();
}
