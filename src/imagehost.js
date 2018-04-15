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

if (process.env.OUTSIDEAWS) {
  console.log('Running outside aws services')
  aws.config.update({region: config.region})
}
const app = new express();
const s3 = new aws.S3();
const httpServer = http.createServer(app)

const port = process.env.PORT || 3000
const host = process.env.HOST || '0.0.0.0'
const socket = process.env.SOCKET || null

app.set('port', port)
app.set('host', host)
app.set('socket', socket)

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
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get(["/:image", "/image/:image"], (req, res, next) => {
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

app.use("/upload", upload.single('image'), (req, res, next) => {
    res.send('/' + req.file.key)
});

app.use('/mupload', upload.any(), (req, res, next) => {
  console.log(req.files)
  res.end(req.files);
})

function AuthCheck (req, res, next) {
  if (req.headers['x-api-key'] === config.key) {
    console.log('User authenticated')
    next()
  } else {
    console.log('User failed authentication')
    res.status(403).json({ code: 403, status: 'Unauthorized access' })
  }
}

function startServer () {
  if (socket) {
    if (fs.existsSync(socket)) {
      fs.unlinkSync(socket)
    }
    httpServer.listen(socket, () => { console.log('Server listening on ' + socket) })
    fs.chmodSync(socket, '0777')
  } else {
    httpServer.listen(port, host, () => {
      console.log('Server listening on ' + host + ':' + port)
    })
  }
}

if (require.main === module) {
    startServer();
}
