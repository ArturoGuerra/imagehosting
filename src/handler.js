const { app } = require('./server.js')
const awsServerlessExpress = require('aws-serverless-express')
const awsServerlessExpressMiddleware = require('aws-serverless-express/middleware')

const binaryMimeTypes = [
  'image/gif',
  'text/css',
  'text/html'
];


app.use(awsServerlessExpressMiddleware.eventContext())
const server = awsServerlessExpress.createServer(app, null, binaryMimeTypes)

exports.render = (event, context) => {
  console.log('proxying event=', event)
  awsServerlessExpress.proxy(server, event, context)
}
