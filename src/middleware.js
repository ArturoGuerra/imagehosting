const AWS = require('aws-sdk')
const uuid = require('uuid/v4')
const multer = require('multer')
const multerS3 = require('multer-s3')

const bucket = process.env.BUCKET || console.log('BUCKET Missing')

if (process.env.REGION) {
  AWS.config.update({ region: process.env.REGION })
}

const s3 = new AWS.S3()

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
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: function (req, file, cb) {
    cb(null, { fieldName: file.fieldname });
  },
  key: function (req, file, cb) {
    let filename_noext = uuid().replace(/-/g, "").substring(0,2) + Date.now();
    let ext = file.mimetype.split('/')[1];
    let filename = filename_noext + "." + ext;
    cb(null, filename);
  }
})

exports.checkBody = (req, res, next) => {
  if (!req.headers.url) {
    res.status(403).send('Invalid credentials')
  } else {
    next()
  }
}

exports.upload = multer({
  storage: storage,
  limits: { fileSize: 100000000 },
  fileFilter: function (req, file, cb) {
    let ext = file.mimetype.split('/')[1];
    if (FileValidation(ext)) {
      cb(null, true);
    }
    else {
      cb(new Error('Only images are allowed'));
    }
  }
})
