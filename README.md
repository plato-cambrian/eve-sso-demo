eve-sso-demo
============
*node.js demo app for EVE Online single sign on*

This is a simple demo to authenticate a user with EVE Online's Single Sign On service.

EVE SSO documentation available at https://developers.testeveonline.com/resource/single-sign-on

All code is in [app.js](https://github.com/plato-cambrian/eve-sso-demo/blob/master/app.js)

Prerequisites
-------------

* git :)
* [node.js and npm](http://nodejs.org/)
* Valid EVE SSO application keys (find them [here](https://developers.testeveonline.com/applications))

Setup and Configuration
-----------------------
    $ git clone https://github.com/plato-cambrian/eve-sso-demo.git; cd eve-sso-demo
    $ cp demo-credentials.js credentials.js
    $ nano credentials.js       # set your keys

Note that as of 10-06-2014, SSO is only enabled on EVE's test server, Singularity. Once this hits the production server, Tranquility, you'll need to change the [auth server](https://github.com/plato-cambrian/eve-sso-demo/blob/master/app.js#L38) to point at TQ.

Usage
-----

    $ npm start
    $ firefox localhost:7888