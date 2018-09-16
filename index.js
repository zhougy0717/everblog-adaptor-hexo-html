'use strict';

const _ = require('lodash')
const fse = require('fs-extra')
const moment = require('moment')
const fm = require('front-matter')
const entities = require('entities')
var enml2html = require('enml2html') // use var for easy mock in mocha testing
const debug = require('debug')('everblog-adaptor-hexo')
const cheerio = require('cheerio')
const format = require('string-format')
const Promise = require('bluebird')
const path = require('path')
const sanitize = require('sanitize-filename')
const parser = require('js-yaml')
const os = require('os')

function resolveNoteResource(resData, title, html) {
  let fileName = resData.attributes.fileName || Date.now().toString()
  fileName = path.basename(fileName.replace(/_/g, ''))
  const hash = bodyHashToString(resData.data.bodyHash)
  const imgFile = format('/images/{}/{}', sanitize(title), fileName)
  fse.outputFileSync(format('{}/source/{}', process.cwd(), imgFile), new Buffer(resData.data.body), 'binary')
  html(format('img[hash="{}"]', hash)).attr('src', imgFile)
}

function processNote(post) {
    const defaultFrontMatter = {
      title: post.title,
      date: formatDate(post.created),
      updated: formatDate(post.updated),
      tags: post.tags
    }
    console.log(post.title)
    debug('content -> %j', post.content)

    let contentMarkdown = enml2html(post.content, post.resources, post.$webApiUrlPrefix, post.noteKey)
    // debug('contentMarkdown -> %j', contentMarkdown)

    let $ = cheerio.load(contentMarkdown)
    const attributes = post.attributes
    if (attributes) {
      const sourceApplication = post.attributes.sourceApplication
      if (sourceApplication && (sourceApplication === 'maxiang')) {
        $('h1').remove()
      }
    }

    // Download all images and update the src attribute.
    if (post.resources) {
      for(let res of post.resources) {
        resolveNoteResource(res, post.title, $)
      }
    }

    // longdesc and alt field will make the HTML show the picture name on page.
    // That is not expected for some inline pictures.
    // Just remove them.
    $('img').attr('longdesc', '')
    $('img').attr('alt', '')
    // Originally, they are inline-block, which will make the view be out of page scope.
    // Making it as block will force everything in scope.
    // $('div').css('display', 'block')
    contentMarkdown = $.html()
    contentMarkdown = removeSpecialChar(contentMarkdown)

    var info = fm(contentMarkdown)
    _.merge(info.attributes, defaultFrontMatter)
    contentMarkdown = fmStringify(info)

    const dist = process.cwd() + '/source/_posts/'
    const filename = (dist + info.attributes.title + '.html').replace(/ /g, '_');
    fse.outputFileSync(filename, contentMarkdown)
    debug('file name-> %s, title -> %s', filename, info.attributes.title)
    debug('body -> %j', contentMarkdown)
}

module.exports = function* (data) {
  let getNote = Promise.promisify(data.noteStore.getNote, { context: data.noteStore })

  for(let post of data.posts) {
    post.noteStore = data.noteStore
    post.$webApiUrlPrefix = data.$webApiUrlPrefix
    console.log('process post -> ' + post.title + ' @ ' + (new Date().valueOf()))
    let note = yield getNote(post.guid, false, true, false, false)
    post.resources = note.resources
    processNote(post)
    console.log('done process -> ' + post.title + ' @ ' + (new Date().valueOf()))
  }
  debug('build success!')
}

function removeSpecialChar(html) {
  html = html.replace(/.*<!DOCTYPE/, '<!DOCTYPE')
  html = html.replace(/{{/g, '&#123;&#123;')
  return html.replace(/}}/g, '&#125;&#125;')
}
function formatDate(timestamp) {
  return moment(timestamp).format('YYYY/M/DD HH:mm:ss')
}

function bodyHashToString(bodyHash) {
  let str = '';
  for (let i in bodyHash) {
    let hexStr = bodyHash[i].toString(16);
    if (hexStr.length === 1) {
      hexStr = '0' + hexStr;
    }
    str += hexStr;
  }
  return str;
}

function fmStringify (obj, opt) {
  obj = obj || {}
  opt = opt || {}
  var attributes = obj.attributes || {}
  var body = obj.body || {}
  var scope = opt.scope || '---'

  if (Object.keys(attributes).length === 0) {
    return body
  }

  var yaml = parser.dump(attributes)
  yaml = scope + os.EOL + yaml + scope + os.EOL + body

  return yaml
}

function sleep(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, ms);
  });
}
