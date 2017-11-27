#!/usr/bin/env nodejs
const express = require('express');
const compression = require('compression');
const http = require('http');
const uuid4 = require('uuid/v4');
const fs = require('fs');
const path = require('path');
const app = new express();
const Multer = require("multer");
const bodyParser = require('body-parser');
const Storage = require('@google-cloud/storage');
const storage = new Storage();
const multer = Multer({limits: {fileSize: 10000000}});
const bucketName = "dixionary-images";
const bucket = storage.bucket(bucketName);
app.use(compression());
app.use(bodyParser.urlencoded({extended: false, limit: "1mb"}));
app.use(bodyParser.json({limit: "1mb"}));
app.use(bodyParser.text({limit: "1mb"}));
app.use('/static', express.static(path.join(__dirname, "static")));
app.set('views', path.join(__dirname, "views"));
app.set('view engine', 'ejs');
app.use((req, res, next) => {
    console.log(`${req.path}`);
    next();
});

app.use("/image/:image", (req, res, next) => {
    if (!req.params.image) {
        res.status(400).send("Invalid file");
    } else {
        storage
            .bucket(bucketName)
            .file(req.params.image)
            .getMetadata()
            .then(result => {
                const metadata = result[0];
                console.log(`File: ${metadata.name}`);
                let img = {};
                img.type = "image";
                img.image = "https://storage.googleapis.com/dixionary-images/" + String(req.params.image);
                res.render('image', img);
            })
            .catch(e => {
                console.error(e);
                res.status(404).send("404 File not found!!");
            });
    }
});

app.post("/upload", multer.single('image'), (req, res, next) => {
    try {
        var image = req.file;
        var filename = uuid4().replace(/-/g, "").substring(0,2) + Date.now()
        var ext = image.mimetype.split('/')[1]
    } catch (e) {
        console.log(e.message);
        var ext = null;
        res.status(400).send("400 Bad Request");
    }
    if (FileValidation(ext)) {
        console.log(req.file);
        let blob = bucket.file(filename + "." + ext);
        let blobStream = blob.createWriteStream({
            metadata: {
                contentType: req.file.mimetype
            }
        });
        blobStream.end(req.file.buffer);
        blobStream.on("start", () => {console.log("STARTED")});
        blobStream.on("error", err => {console.log(err)});
        blobStream.on("finish", () => {
            blob.makePublic().then(() => {
                res.send("/image/" + blob.name);
            }).catch(console.error);
        });
    } else {
        res.status(400).send("400 Invalid Filetype")
    }
});

function FileValidation(ext) {
    const validfiles = ['png', 'jpg', 'jpeg', 'gif'];
    return validfiles.some((element, index, array) => {
        return element === ext;
    });
}

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
