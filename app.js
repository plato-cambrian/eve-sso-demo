/*
 * eve-sso-demo 0.2.0 
 *   by plato-cambrian
 *
 *
 * Be sure to create credentials.js, and set a user agent in Global Vars
 * Docs: https://developers.testeveonline.com/resource/single-sign-on
 *
 *
 *  SETUP
 */

// Confirm some credentials are available:
try{
  var credentials = require('./credentials.js');
} catch(e) {
  console.log(
    'Failed to find EVE SSO app credentials\n'
   +'Edit credentials-demo.js and save as credentials.js.\n'
   +'Get credentials at:\n'
   +'https://developers.testeveonline.com/resource/single-sign-on'
  );
  throw('No credentials.js')
}

// Global Vars:
var EVE_SSO_CLIENTID = credentials.client_id;
var EVE_SSO_SECRET = credentials.client_secret;
var EVE_SSO_CALLBACK_URL = credentials.callback_url; 
// callback URL must match both CCP website and path in router
// dev note: noscript prevents redirection to localhost URI's

// Set the authentication server. As of 2014-10-06, only the Singularity test server is available.
//var EVE_SSO_HOST = 'login.eveonline.com';
var EVE_SSO_HOST = 'sisilogin.testeveonline.com';

// Set a string that identifies your app as the user agent:
var MY_USER_AGENT = 'express 4.9.5, eve-sso-demo 0.2.0, EVE client_id ' + EVE_SSO_CLIENTID;


// Load nodejs libraries:
var url = require('url');
var path = require('path');

// these libraries need an `npm install` first. `npm start` also installs them:
var request = require('request');
var express = require('express');


/*
 *  EXPRESS WEB SERVER
 *    http://expressjs.com/
 */

var app = express();
var router = express.Router();

// Requests are passed through the chain of app.use() request handlers in order,
// until something throws an error or sends a response:

// First, log incoming requests:
app.use(function(req, res, next) {
  console.log('%s %s', req.method, req.url);
  next();  // calling the next argument tells express to hand the request down the chain
});

// Try to serve requests as static files:
app.use(express.static(__dirname+'/assets'));
// Caution, this folder has path `/`. don't put a leading `/assets` in your request path

// Pass anything that wasn't served as static to the router:
app.use(router);

// Pass any unrouted requests and exceptions to an error handler:
app.use(function(err, req, res, next){
  // a count of four function arguments tells express this is an error handler
  console.error(err);
  console.error(err.stack);
  res.status(500).send('Internal Server Error');
})

// Start http server:
app.listen(7888, function(err){
  if(err){
    return console.log('Couldn\'t start server on port 7888:\n', err)
  }
  console.log('Express started on port 7888');
});


/* 
 *  ROUTES
 */

// We have only two SSO-specific routes:
//   /evesso/begin:    redirect a user to CCP
//   /evesso/callback: CCP redirects the user here with an code after login

// Respect CCP's api by sending a unique user agent:
router.all('*', function(req, res, next){
  res.setHeader('User-Agent', MY_USER_AGENT)
  next();
})

// STEP 0. Render a 'Sign on with EVE SSO' button that goes to our own route /evesso/begin
// You could template the appropriate EVE_SSO_HOST URL into the client html and skip this step,
// but that means CCP sees a browser user-agent on the initial request, instead of yours
router.get('/', function(req, res){
  var html = buildHTML(
    '<a href="/evesso/begin">'
   +'<img src="/EVE_SSO_Login_Buttons_Large_Black.png" style="display:block; margin: auto;">'
   +'</a>'
  );
  res.status(200).send(html);
});

// STEP 1. Redirect user to CCP, where they login.
router.get('/evesso/begin', function(req, res){

  // example oauth start URI, from CCP docs (linked at top):
  // https://
  //    login.eveonline.com
  //       /oauth/authorize/
  //          ?response_type=code
  //          &redirect_uri=https://3rdpartysite.com/callback
  //          &client_id=3rdpartyClientId
  //          &scope=
  //          &state=uniquestate123

  var urlObj = {
    protocol: 'https',
    host: EVE_SSO_HOST,
    pathname: '/oauth/authorize',
    query:{
      response_type: 'code',
      redirect_uri: EVE_SSO_CALLBACK_URL,  // This must exactly match what you set on CCP's site
      client_id: EVE_SSO_CLIENTID,
      scope: '',
      state: 'my non-unique state',        // use a unique per-request value in CSRF defense, i guess?
    },
  };

  // Use node's url library to assemble the URL:
  var ssoBeginURL = url.format(urlObj);

  // User agent was already set by previous middleware. Redirect user to EVE_SSO_HOST:
  res.redirect(302, ssoBeginURL);
})


// STEP 2. CCP redirects the user from their /oauth/authorize to our /evesso/callback with an auth code,
// We will make two requests to CCP before sending any response to the user's request for /evesso/callback.

router.get('/evesso/callback', function(req, res){
  //console.log('Got redirected to /evesso/callback by CCP')

  var authCode = req.query['code'];

  // STEP 3. We have a one-time-use auth code from CCP in the /evesso/callback query string.
  // We must make a request with our secret and code, to get a token for this user:
  requestToken(authCode, function(err, response3, bodyObj){
    // Now that we're in this callback, requestToken() completed its request/response.

    if (!err && response3.statusCode == 200) {
      var token = bodyObj.access_token;

      // STEP 4. We have a token from /oauth/token
      // We must make a request with the token to get CharacterID:
      requestCharacterID(token, function(err, response4, bodyObj){
        // Now that we're in this callback, requestCharacterID() completed its request/response.
        if (!err && response4.statusCode == 200) {
          var charId = bodyObj.CharacterID;
          var charName = bodyObj.CharacterName;
          var html = buildHTML('Welcome, '+charName+'... to PANTHEON');
          res.status(200).send(html);
        } else {
          console.log(err);
          console.log(response4.body);
          var html = buildHTML('Authentication error!')
          return res.status(500).send(html);
        }
      });
    } else {
      console.log(err);
      console.log(response3.body);
      var html = buildHTML('Authentication error!')
      return res.status(500).send(html);
    }
  });
});


/* 
 *  HELPER FUNCTIONS
 *    Placed down here to help keep routes legible
 */

function requestToken(authCode, callback){
  // Build URL for token request:
  var urlObj = {
    protocol: 'https',
    host: EVE_SSO_HOST,
    pathname: '/oauth/token',
  }
  var ssoTokenUrl = url.format(urlObj);

  // Build the authentication string:
  var tokenAuthHeaderString = 
    "Basic "
    + base64ify(EVE_SSO_CLIENTID + ":" + EVE_SSO_SECRET);

  // Set up options for the post request:
  var postOptions = {
    url: ssoTokenUrl,
    headers:{
      "Authorization": tokenAuthHeaderString,
      //"Host": EVE_SSO_HOST,
      "User-Agent": MY_USER_AGENT,
    },
    form:{
      grant_type: "authorization_code",
      code: authCode,
    }
  }

  // Send request:
  request.post(postOptions, function (err, response, body) {
    // Handle response:
    if (!err && response.statusCode == 200) {
      var bodyObj = JSON.parse(body);
      callback(null, response, bodyObj)
    } else {
      callback(err, response);
      //console.log(response);
    }
  })
}

function requestCharacterID(token, callback){
  // Build URL for verify request:
  var urlObj = {
    protocol: 'https',
    host: EVE_SSO_HOST,
    pathname: '/oauth/verify',
  }
  var ssoVerifyUrl = url.format(urlObj);

  // Build the auth header from recently acquired token:
  var verifyAuthHeaderString = "Bearer " + token;

  // Set up options for the get request:
  var getOptions = {
    url: ssoVerifyUrl,
    headers:{
      "Authorization": verifyAuthHeaderString,
      "User-Agent": MY_USER_AGENT,
    }
  }

  // Send response:
  request.get(getOptions, function (err, response, body) {
    if (!err && response.statusCode == 200) {
      var bodyObj = JSON.parse(body);
      callback(null, response, bodyObj)
    } else {
      callback(err, response);
    }
  })
}


/* 
 *  UTILITY
 */
function base64ify(input){
  // we use this to craft the Authentication header for token request:
  var authHeader = new Buffer(input, 'utf8').toString('base64');
  return authHeader;
}

function buildHTML(input){
  var output = 
    '<html><head></head>'
   +'<body style="background-color: #888888; color: #dddddd; text-align: center; margin:200 auto;">'
   +input
   +'<br><a href="/">Home</a>'
   +'</body></html>';
  return output;
}
