#!/usr/bin/env node
const aws = require('aws-sdk');
const express = require('express');
const compression = require('compression');
const http = require('http');
const uuid4 = require('uuid/v4');
const fs = require('fs');
const path = require('path');
const morgan = require('morgan');
const multer = require("multer");
const multerS3 = require("multer-s3");
const bodyParser = require('body-parser');

if (process.env.OUTSIDEAWS) {
  console.log('Running outside aws services')
  aws.config.update({ region: process.env.REGION })
}

const app = new express();
const s3 = new aws.S3();
const httpServer = http.createServer(app)

const port = process.env.PORT || 3000
const host = process.env.HOST || '0.0.0.0'
const socket = process.env.SOCKET || null
const bucket = process.env.BUCKET || null
const coldstore = process.env.COLDSTORE || null
const dev_mode = (!process.env.NODE_ENV === 'production')

app.set('port', port)
app.set('host', host)
app.set('socket', socket)

if (!dev_mode) {
  app.set('trust proxy', function (){ return true })
}

function FileValidation(ext) {
    const validfiles = ['png', 'jpg', 'jpeg', 'gif'];
    return validfiles.some((element, index, array) => {
        return element === ext;
    });
}

const storage = multerS3({
    s3: s3,
    bucket: bucket,
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
    limits: { fileSize: 100000000 },
    fileFilter: function(req, file, cb) {
        let ext = file.mimetype.split('/')[1];
        if (FileValidation(ext)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only images are allowed'));
        }
    }
})

app.use(morgan('short'));
app.use('/static', express.static(path.join(__dirname, 'static')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get(["/:image", "/image/:image"], checkImage, (req, res, next) => {
  let img = {};
  img.name = req.params.image;
  s3.getObject({ Bucket: bucket, Key: req.params.image }, (err, data) => {
    if (err) {
      img.image = coldstore + "/" + req.params.image
    } else {
      img.image = "https://s3.amazonaws.com/"+ bucket + "/" + req.params.image
    }
    res.render("image", img);
  })
});

app.post("/upload", upload.single('file'), (req, res, next) => {
  res.send('/' + req.file.key)
});

app.post('/post', upload.array('files', 12), (req, res, next) => {
  let results = []
  for (let i = 0; i < req.files.length; i++) {
    results.push({ url: 'https://img.dixionary.com', key: req.files[i].key, bucket: 'https://s3.amazonaws.com/img-dixionary/' })
  }
  console.log(results)
  res.json(results);
})

function checkImage (req, res, next) {
  if (!req.params.image) {
    res.status(400).send('Invalid file')
  } else {
    next()
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
