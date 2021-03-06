#!/usr/bin/env node

var argv = require('minimist')(process.argv.slice(2));
var chalk = require('chalk');
var fs = require('fs');
var git = require('git-rev');
var knox = require('knox');
var slack = require('slack-node');
var debug = require('debug')('laggit');


var S3_ACCESS_KEY_ID = process.env.LAGGIT_S3_KEY;
var S3_SECRET_ACCESS_KEY = process.env.LAGGIT_S3_SECRET;
var S3_BUCKET_NAME = process.env.LAGGIT_S3_BUCKET;
var SLACK_TEAM_NAME = process.env.LAGGIT_SLACK_TEAM;
var SLACK_TOKEN = process.env.LAGGIT_SLACK_TOKEN;
var SLACK_DEFAULT_CHANNEL = process.env.LAGGIT_SLACK_CHANNEL;
var user = process.env.USER;
var repoDirname = process.cwd().split('/').pop();

var slackClient = new slack(SLACK_TOKEN, SLACK_TEAM_NAME);
var s3client = knox.createClient({
  key: S3_ACCESS_KEY_ID,
  secret: S3_SECRET_ACCESS_KEY,
  bucket: S3_BUCKET_NAME
});

function bucketPath(filePath) {
  return 'https://s3-eu-west-1.amazonaws.com/' + S3_BUCKET_NAME + '/' +
    filePath;
}

function sendSlackMsg(msg) {
  slackClient.webhook({
    channel: argv.channel || SLACK_DEFAULT_CHANNEL,
    text: msg
  }, function(err, response) {
    if (response.statusCode !== 200) {
      console.log(chalk.red("Slack communication error."));
      console.log(chalk.red(response.response));
    }
  });
}

function saveLocalPictureToAmazon(localPath) {
  fs.stat(localPath, function(err, stat){
    if (!stat) {
      debug('Lolcommit not found for: ' + localPath);
      return;
    }
    var filename = localPath.split('/').pop();
    var s3path = user + '/' + repoDirname + '/' + filename;
    var req = s3client.put(s3path, {
      'Content-Length': stat.size,
      'Content-Type': 'text/plain'
    });
    fs.createReadStream(localPath).pipe(req);
    req.on('response', function(res){
      sendSlackMsg(bucketPath(s3path));
      debug('Lolcommit found and sent to s3: ' + localPath);
    });
  });
}

// run
git.long(function (str) {
  var lastCommitSha = str.substring(0, 11);
  var commitPicturePath = '/Users/' + user + '/.lolcommits/' +
    repoDirname + '/' + lastCommitSha + '.jpg';
  var commitGifPath = '/Users/' + user + '/.lolcommits/' +
    repoDirname + '/' + lastCommitSha + '.gif';
  saveLocalPictureToAmazon(commitPicturePath);
  saveLocalPictureToAmazon(commitGifPath);
});
