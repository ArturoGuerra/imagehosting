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

async function imageExists (image) {
  return new Promise((resolve, reject) => {
    s3.getObject({ Bucket: bucket, Key: image }, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

exports.getImage = async (req, res, next) => {
  try {
    await imageExists(req.params.image)
    next()
  } catch (e) {
    res.render('404')
  }
}

exports.checkImage = (req, res, next) => {
  if (!req.params.image) {
    res.status(400).send('Invalid file')
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
