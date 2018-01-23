console.log("Server started");

var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var mysql = require('mysql');
var moment = require('moment');
var session = require('express-session');
var passport = require('passport');
var config = require('./config');
var app = express();
var lang = null;

var users = {};

require('./app/routes.js')(app, passport);

var config = require("./config.js");
var Strategy = require('openid-client').Strategy;
var Issuer = require('openid-client').Issuer;
var registerPassport = function (client, params) {
	passport.use('oidc', new Strategy({ client, params }, function (tokenset, done) {
		var email = tokenset.claims.email;
		var name = tokenset.claims.name;
		if (!config.allowed.test(email)) {
			return done(null, false, { message: "Can't login, bad email. " });
		}

		var profile = {
			email,
			name,
			sub: tokenset.claims.sub
		};
		console.log(users);
		users[profile.sub] = profile;
		return done(null, profile);
	}));

	app.get('/login', passport.authenticate('oidc',
	  {
		successRedirect: '/events',
		failureRedirect: '/',
		failureFlash: true,
	  }
	));

	app.get('/callback', passport.authenticate('oidc',
	  {
		successRedirect: '/events',
		failureRedirect: '/',
		failureFlash: true,
	  }
	));
}
Issuer.defaultHttpOptions = { timeout: 10000 };
Issuer.discover(config.oidc.issuer)
.then(function (issuer) {
	var client = new issuer.Client({
		client_id: config.oidc.client_id,
		client_secret: config.oidc.client_secret,
		redirect_uris: [config.oidc.redirect_uri],
	});
	setTimeout(function(){ // lazy way to ensure these routes are set up last
		registerPassport(client, {
			scope: 'openid profile email'
		});
	}, 1000);
}).catch(function (error) {
	console.error(error);
	process.exit();
});

app.use((req, res, next) => { console.log(req.url); next() });

passport.serializeUser(function(user, done) {
	done(null, user.sub);
});

passport.deserializeUser(function(sub, done) {
	process.nextTick(function() {
		done(null, users[sub]);
	});
});

//view engine setup
app.set('view engine', 'ejs');

//app.use(express.methodOverride());
app.use(cookieParser());

//Session setup
app.use(session({
	secret:'keyboard cat', resave: true, saveUninitialized: false
}));

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use(passport.initialize());
app.use(passport.session());

app.use('/', express.static('./public'));

//i18n

//Routes
//app.use('/', routes);
// routes =====================================================================
app.get('/', function(req, res){
	if (req.user) {
		res.redirect("/events");
	} else {
  		res.render('index');
	}
});

app.get('/events', function(req, res){
 console.log(req.user.name);
 res.render('index.ejs');
})

app.get('/logout', function(req, res){
	if(req.user){
		req.session.destroy(function(err) {
      		req.logout();
      		res.redirect(config.destroySessionUrl);
    	});
	}
});

// ==========================================================================

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login');
};

 var server = app.listen(8080, function(){
 	var host = server.address().address;
 	var port = server.address().port;

 	console.log('App listening at http://%s:%s', host, port);
 });