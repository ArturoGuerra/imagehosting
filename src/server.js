#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const express = require('express');
const { getImage, checkImage, upload } = require('./middleware');

const app = new express();
const httpServer = http.createServer(app);

const port = process.env.PORT || 3000
const host = process.env.HOST || '0.0.0.0'
const socket = process.env.SOCKET || null
const base_url = process.env.BASE_URL || console.log('BASE_URL Missing')
const image_cdn = process.env.IMAGE_CDN || console.log('IMAGE_CDN Missing')
const dev_mode = (!process.env.NODE_ENV === 'production');

app.set('port', port);
app.set('host', host);
app.set('socket', socket);

if (!dev_mode) {
  app.set('trust proxy', 1)
}

app.use(cors());
app.use(morgan('short'));
app.use('/static', express.static(path.join(__dirname, 'static')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');


app.get('/:image', checkImage, getImage, (req, res) => {
  let data = {
    name: req.params.image,
    image: `${image_cdn}/${req.params.image}`
  }
  res.render('image', data)
});

app.post("/upload", upload.single('file'), (req, res, next) => {
  res.send('/' + req.file.key)
});

app.post('/post', upload.array('files', 12), (req, res, next) => {
  let results = []
  for (let i = 0; i < req.files.length; i++) {
    results.push({ url: base_url, key: req.files[i].key, bucket: base_cdn })
  }
  res.json(results);
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

exports.app = app
