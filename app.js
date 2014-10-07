// https://developers.testeveonline.com/resource/single-sign-on
// Be sure to configure credentials.js
// eve-sso-demo 0.1.0 by plato-cambrian

/*
 *  SETUP
 */

// Load nodejs libraries:
var url = require('url');
var path = require('path');

// these libraries need an `npm install` first:
var request = require('request');
var express = require('express');

// Confirm some credentials are available:
try{
  var credentials = require('./credentials.js');
} catch(e) {
  console.log('Failed to find EVE SSO app credentials\n'
             +'Copy credentials-demo.js to credentials.js and edit.'
             +'Get credentials at:'
             +'https://developers.testeveonline.com/resource/single-sign-on'
             );
  throw('No credentials.js')
}

// Set global vars for clientId and secret from credentials:
var EVE_SSO_CLIENTID = credentials.client_id;
var EVE_SSO_SECRET = credentials.client_secret;
// Set your app's URL where CCP should redirect a user after an auth attempt:
var EVE_SSO_CALLBACK_URL = credentials.callback_url;
// (dev note: noscript prevents redirection to localhost URI's)

// Set SSO server:
//var EVE_SSO_HOST = 'login.eveonline.com';  // disabled as of 2014-10-06
var EVE_SSO_HOST = 'sisilogin.testeveonline.com';


/*
 *  EXPRESS WEB SERVER
 */

var app = express();

// Requests are passed through the chain of app.use request handlers in order,
// until something throws an error or sends a response.
// Requests hit the router at the end of the app.use chain.

// Log requests
app.use(function(req, res, next) {
  console.log('%s %s', req.method, req.url);
  next();  // calling the next argument tells express to hand the request down the chain
});

// Try to serve requests as static files. 
app.use(express.static(__dirname+'/assets'));
// Caution, this folder has path `/`, don't put a leading `/assets` in your request path

app.use(function(req, res, err, next){
  // four function arguments tells express this is an error handler
  console.log(err);
  res.status(500).send();
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

// Render SSO button:
app.get('/', function(req, res){
  var html = buildHTML(
    '<a href="/evesso/begin">'
   +'<img src="/EVE_SSO_Login_Buttons_Large_Black.png" style="display:block; margin: auto;">'
   +'</a>'
    );
  res.status(200).send(html);
});


// We have only two SSO routes.
// /evesso/begin:    redirect a user to CCP
// /evesso/callback: CCP redirects the user here with an code after login

// Step 1. Redirect user to CCP, where they login.
app.get('/evesso/begin', function(req, res){

  // example redirect uri, from CCP docs (linked at top):
  // https://
  //    login.eveonline.com
  //       /oauth/authorize/
  //          ?response_type=code
  //          &redirect_uri=https://3rdpartysite.com/callback
  //          &client_id=3rdpartyClientId
  //          &scope=
  //          &state=uniquestate123

  // Define CCP's oauth login url:
  var urlObj = {
    protocol: 'https',
    host: EVE_SSO_HOST,
    pathname: '/oauth/authorize',
    query:{
      response_type: 'code',
      redirect_uri: EVE_SSO_CALLBACK_URL,  // This must exactly match what you gave CCP
      client_id: EVE_SSO_CLIENTID,
      scope: '',
      state: 'my non-unique state',        // use a unique per-request value in CSRF defense, i guess?
    },
  };

  // Use node's url library to assemble the URL:
  var ssoBeginURL = url.format(urlObj);

  // Send the user there:
  res.redirect(302, ssoBeginURL);
})


// Step 2. CCP redirects the user from their /oauth/authorize to our /evesso/callback with an auth code,
// We will make two requests to CCP before sending any response to the user's request for /evesso/callback.

app.get('/evesso/callback', function(req, res){
  //console.log('Got redirected to /evesso/callback by CCP')

  var authCode = req.query['code'];

  // Step 3. We have a one-time-use auth code from CCP in the /evesso/callback query string.
  // We must make a request with our secret and code, to get a token for this user:
  requestToken(authCode, function(err, response3, bodyObj){
    // Now that we're in this callback, requestToken() completed its request/response.

    if (!err && response3.statusCode == 200) {
      var token = bodyObj.access_token;

      // Step 4. We have a token from /oauth/token
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
 *  HANDLERS
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

  // Set up options for the post request:
  var getOptions = {
    url: ssoVerifyUrl,
    headers:{
      "Authorization": verifyAuthHeaderString,
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
