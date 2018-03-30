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
const storage = Multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'images')
    },
    filename: function(req, file, cb) {
        let filename_noext = uuid4().replace(/-/g, "").substring(0,2) + Date.now()
        let ext = file.mimetype.split('/')[1]
        let filename = filename_noext + "." + ext
        cb(null, filename)
    }
});

const multer = Multer({limits: {fileSize: 100000000}, storage:storage});
app.use(compression());
app.use(bodyParser.urlencoded({extended: false, limit: "100mb"}));
app.use(bodyParser.json({limit: "100mb"}));
app.use(bodyParser.text({limit: "100mb"}));
app.use('/static', express.static(path.join(__dirname, "static")));
app.use('/images', express.static(path.join(__dirname, "images")));
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
        fs.stat(path.join(__dirname, "images",  req.params.image), (error, stats) => {
            if (error === null) {
                var img = {
                    image: "/images/" + req.params.image,
                    name: req.params.image
                }
                res.render('image', img);
            } else {
                res.status(404).send("404 File not found")
            }
        });
    }
});

app.post("/upload", multer.single('image'), (req, res, next) => {
    res.send('/image/' + req.file.filename)
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
