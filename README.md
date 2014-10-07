eve-sso-demo
============

This is a simple node.js demo app to authenticate a user with EVE Online's Single Sign On service.

EVE SSO documentation available at https://developers.testeveonline.com/resource/single-sign-on

All code is in [app.js](https://github.com/plato-cambrian/eve-sso-demo/blob/master/app.js)

Prerequisites
-------------

* git :)
* [node.js and npm](http://nodejs.org/)
* Valid EVE SSO application keys (find them [here](https://developers.testeveonline.com/applications))


Usage
-----

    $ git clone https://github.com/plato-cambrian/eve-sso-demo.git; cd eve-sso-demo
    $ cp demo-credentials.js credentials.js
    $ vim credentials.js
    $ npm start
    $ firefox localhost:7888