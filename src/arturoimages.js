#!/usr/bin/env nodejs
const express = require('express');
const compression = require('compression');
const http = require('http');
const uuid4 = require('uuid/v4');
const fs = require('fs');
const path = require('path');
const app = new express();
const fileUpload = require('express-fileupload');
const bodyParser = require('body-parser');

app.use(compression());
app.use(fileUpload({preserveExtension: true}));


app.use(bodyParser.urlencoded({extended: false }));
app.use(bodyParser.json());
app.use(bodyParser.text());
app.use('/static', express.static(path.join(__dirname, "static")));
app.use('/images', express.static(path.join(__dirname, "images")));
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
        fs.stat('images/' + req.params.image, (error, stat) => {
            if (error == null) {
                var img = {type: "image", image: "/images/" + req.params.image}
                console.log(img);
                res.render('image', img);
            }
        });
    }
});

app.post("/upload", (req, res, next) => {
    if (req.body.password === "9RYJ)>rmQuSfD>#") {
        try {
            var filename = uuid4().replace(/-/g, "");
            var image = req.files.image;
            var ext = image.mimetype.split('/')[1]
        } catch (e) {
            console.log(e.message);
            var ext = null;
            res.status(400).send("400 Bad Request");
        }
        if (FileValidation(ext)) {
            image.mv('images/' + filename + "." + ext, (err) => {
                if (err) {
                    console.error("Error:" + err.message);
                    res.code(err.code).send(err.message);
                } else {
                    console.log("Uploaded:" + filename);
                    res.send("/image/" + filename + "." + ext);
                }
            });
        } else {
            res.status(400).send("400 Invalid Filetype");
        }
    } else {
        res.status(403).send("403 FUCK OFF");
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
    var server = http.createServer(app);
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
}

if (require.main === module) {
    startServer();
}
