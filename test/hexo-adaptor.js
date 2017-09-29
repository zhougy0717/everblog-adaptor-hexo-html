'use strict'

const fse = require('fs-extra')
const should = require('should')
const co = require('co')
const cheerio = require('cheerio')
const rewire = require("rewire");
const fm = require('front-matter')
const format = require('string-format')
const sinon = require('sinon')
const enml2html = require('enml2html')
var processor = rewire('../index')

describe('generate html blog post based notes data', function () {
  var stubEnml2Html = sinon.stub()
  var data
  var outputFileSync
  beforeEach('setUp', function () {
    processor.__set__('enml2html', stubEnml2Html)
    outputFileSync = sinon.spy(fse, 'outputFileSync')
    data = {
      attributes: {
        title: "test, blog title"
      },
      webApiUrlPrefix: "test url prefix",
      noteStore: {
        getResource: sinon.stub()
      },
      posts: []
    }
  })

  afterEach('tearDown', function () {
    outputFileSync.restore()
  })
  it('note2html', function(){
    const resData = {
      attributes: {
        fileName: '__test_resource'
      },
      data: {
        bodyHash: [0],
        body: [12,34,56,78]
      }
    }
    data.posts[0] = { // post with resources
      title: "test note title",
      created: 1498021041970,
      updated: 1498021041970,
      tags: [],
      resources: [
        { 
          guid: '123456',
        }
      ]
    }
    data.noteStore.getResource.callsArgWith(5, null, resData)
    stubEnml2Html.returns(""+
      "<div>" +
        "<img alt='123' " +
             "longdesc='123' "+
             "hash='00' "+
             "src='http://web.test.com'>"+
        "</img>"+
      "</div>"
    )
    return (function(){
      return co(function*(){
        return yield processor(data)
      })
    }()).should.not.be.rejected()
      .should.be.fulfilled().then(function(){
        // verify
        data.posts.forEach(post => {
          outputFileSync.calledTwice.should.be.true()
          let html = outputFileSync.args[1][1]
          fm.test(html).should.be.true()
          let content = fm(html).body
          let $ = cheerio.load(content)
          $('img').should.exist
          $('img').each(function(){
            $(this).attr('longdesc').should.be.equal('')
            $(this).attr('alt').should.be.equal('')
            $(this).attr('src').should.startWith('/images/')
            $(this).attr('src').indexOf('_').should.equal(-1)
          })
        })
      })
  })

  it('should convert enml with no resource to html', function () {
    data.posts[0] = {
      title: "test note title",
      created: 1498021041970,
      updated: 1498021041970,
      tags: [],
    }
  
    stubEnml2Html.returns('<div></div>')
    return (function(){
      return co(function*(){
        return yield processor(data)
      })
    }()).should.be.fulfilled()
  })

  it('should replace all curly braces', function () {
    data.posts[0] = {
      title: "test note title",
      created: 1498021041970,
      updated: 1498021041970,
      tags: [],
    }

    stubEnml2Html.returns("<div>{}</div>")
    return (function(){
      return co(function*(){
        return yield processor(data)
      })
    }()).should.be.fulfilled().then(function () {
      let html = outputFileSync.args[0][1]
      html.indexOf('{').should.equal(-1)
      html.indexOf('}').should.equal(-1)
    })
  })

  it('post with special title', function(){
    data.posts[0] = {
      title: "illegal sign :",
      created: 1498021041970,
      updated: 1498021041970,
      tags: [],
    }
    return (function(){
      return co(function*(){
        return yield processor(data)
      })
    }()).should.be.fulfilled()
  })
})
