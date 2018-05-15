#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const express = require('express');
const bodyParser = require('body-parser');
const { checkBody, upload } = require('./middleware');

const app = exports.app = new express();
const httpServer = http.createServer(app);

const port = process.env.PORT || 3000
const host = process.env.HOST || '0.0.0.0'
const socket = process.env.SOCKET || null
const dev_mode = (!process.env.NODE_ENV === 'production');

app.set('port', port);
app.set('host', host);
app.set('socket', socket);

if (!dev_mode) {
  app.set('trust proxy', 1)
}

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(morgan('short'));

app.post("/upload", checkBody, upload.single('file'), (req, res, next) => {
  res.send(`${req.headers.url}/${req.file.key}`)
});

app.post('/post', checkBody, upload.array('files', 12), (req, res, next) => {
  let results = []
  for (let i = 0; i < req.files.length; i++) {
    results.push({ url: `${req.headers.url}/${req.files[i].key}` })
  }
  res.send(results);
})

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
