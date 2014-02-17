"use strict"

var express = require('express')
var path = require('path')
var passport = require('passport')
var LocalStrategy = require('passport-local').Strategy

var app = express() 

var MonitorInfo = require('./core/ping')
var websites = require('./websites')
var appSettings = require('./settings')

var monitors = []
var errors = []
var warnings =[]

app.set('port', process.env.PORT || 3000)
app.use(express.json())
app.use(express.urlencoded())
app.use(express.methodOverride())
app.use(express.cookieParser())

app.use(express.session({ 
	secret: 'Z5V7J54G5TGC445VU5B7J556B3N6V6H5V4', 
	cookie: { maxAge: 60 * 10 * 1000 }  
	}))

app.use(passport.initialize())
app.use(passport.session()) 
app.use(app.router)
app.use(express.static(path.join(__dirname, 'public')))

//==================================================================
// auth
passport.use(new LocalStrategy(
  function(username, password, done) {
    if (username === "q" && password === "q")
    {
         return done(null, {name: username})
    }
    return done(null, false)
  }
))

passport.serializeUser(function(user, done) {
    done(null, user)
})

passport.deserializeUser(function(user, done) {
    done(null, user)
})

var auth = function(req, res, next){
  if (!req.isAuthenticated()) 
  	res.send(401)
  else
  	next()
}
//==================================================================

//==================================================================
//get route
app.get('/getdata/:hash*', function(req, res, next) { 	
	var monitorsMini=[]
  	monitors.forEach(function (monitorInfo) {
  		monitorsMini.push(monitorInfo.getData())
	})
	res.writeHead(200, {"Content-Type": "application/json"})
  	res.write(JSON.stringify(monitorsMini))
  	res.end() 
})

app.get('/monitor/:id*/:hash*', function(req, res, next) {
	var info = getMonitorById(req.param('id'))	
	if (info)
		{
			res.writeHead(200, {"Content-Type": "application/json"})
  			res.write(JSON.stringify(info.getSetting()))
  		}
  	else
	  	{
	  		res.writeHead(404, {"Content-Type": "text/html"})
	  	} 
    res.end()   
})


app.get('/detail/:id*/:hash*', function(req, res, next) {
	if (!appSettings.getData().useDataBase)
	{
		var info = getMonitorById(req.param('id'))		
		if (info)
			{
				res.writeHead(200, {"Content-Type": "application/json"})
	  			res.write(JSON.stringify(info.getDetail()))
	  		}
	  	else
		  	{
		  		res.writeHead(404, {"Content-Type": "text/html"})
		  	} 
	    res.end()  
    } 
})

app.get('/setting/:hash*', auth, function(req, res, next) {
	res.writeHead(200, {"Content-Type": "application/json"})
	res.write(JSON.stringify(appSettings.getData()))
	res.end()	 
})

app.get('/alert/:hash*', function(req, res, next) {	
	var monitorsMini=[]
	var monitor

  	errors.forEach(function (id) {
  		monitor = getMonitorById(id)
		if (monitor)
		  {
		  	monitorsMini.push(monitor.getData())
		  }	
	})

	warnings.forEach(function (id) {
  		monitor = getMonitorById(id)
		if (monitor)
		  {
		  	monitorsMini.push(monitor.getData())
		  }	
	})
	res.writeHead(200, {"Content-Type": "application/json"})
  	res.write(JSON.stringify(monitorsMini))
  	res.end() 
})

//==================================================================

//==================================================================
//post route

app.post('/stop', auth, function(req, res, next) {
	var monitor = getMonitorById(req.body.id)
	if (monitor)
	{
		monitor.stop()
	}
	res.send( monitor ? 200 :404) 
})


app.post('/start', auth, function(req, res, next) {
	var monitor = getMonitorById(req.body.id)
	if (monitor)
	  {
	  	monitor.start()
	  }
	res.send( monitor ? 200 :404)   
})

app.post('/del', auth, function(req, res, next) {
	var monitor = getMonitorById(req.body.id)
	if (monitor)
	  {
	  	monitor.stop()
	  	var index = monitors.indexOf(monitor)
		if(index != -1) {
			monitors.splice(index, 1)
		}
	  }
	res.send( monitor ? 200 :404) 
})

app.post('/setting', auth, function(req, res, next){	
	appSettings.update(req.body)
  	monitors.forEach(function (monitorInfo) {
  		monitorInfo.reloadDefault(appSettings.getData())
  	})
	res.send(200)
})


app.post('/edit/:id*', auth, function(req, res, next){

	var monitor = getMonitorById(req.param('id'))
	if (monitor)
	  {
	  	monitor.update(req.body)
	  }
	res.send( monitor ? 200 :404) 
})

app.post('/add', auth, function(req, res, next){
	addMonitor(req.body)
	res.send(200)
})

app.post('/login', passport.authenticate('local'), function(req, res) {
  res.send(200)
})

app.post('/logout', function(req, res){
  req.logOut()
  res.send(200)
})

//==================================================================

app.get('/auth/:hash*', function(req, res) {
  res.send(req.isAuthenticated() ? req.user : '0')
})

app.use(function(req, res) {
 	res.sendfile(__dirname + '/public/index.html')
})

//==================================================================
// run server
var server = require('http').createServer(app).listen(app.get('port'), function(){
  	console.log('Express server listening on port ' + app.get('port'))
})

var io = require('socket.io').listen(server)
io.set('log level', 1)

io.sockets.on('connection', function(socket) {
 	sendAlert()
})

//==================================================================

//==================================================================
//
function sendAlert()
{
	io.sockets.emit('alert', { error: errors.length, warning: warnings.length })
}

function getMonitorById(value)
{
	var result  = monitors.filter(function(o){return o.id == value} )
  	return result? result[0] : null 
} 

function getLastId()
{
	var id=0
	monitors.forEach(function (monitorInfo) {
  		id = monitorInfo.id < id ? id : monitorInfo.id
  	})
  	return id+1
}

function addMonitor(data)
{
	var monitor = new MonitorInfo ({
        url: data.url,
        website: data.website,

        timeout: data.timeout,
        warningTime: data.warningTime,
        
        id: data.id || getLastId(),

        useProxy: data.useProxy,
        proxyUrl: data.proxyUrl,
        useDefaultProxy: data.useDefaultProxy,

        errorForSend: data.errorForSend,
        sendAlert: data.sendAlert,

		useDefaultCredentials: data.useDefaultCredentials,
		useCredentials: data.useCredentials,
		userName: data.userName,
		userPassword: data.userPassword

    }).on('sendError', function(id){
    	if (errors.indexOf(id) == -1)
		{
			errors.push(id)
			if (warnings.indexOf(id) >-1)
			{
				warnings.splice(warnings.indexOf(id), 1)
			}
			sendAlert()
		}
    }).on('sendWarning', function(id){
    	if (warnings.indexOf(id) == -1)
		{
			warnings.push(id)
			if (errors.indexOf(id) >-1)
			{
				errors.splice(errors.indexOf(id), 1)
			}
			sendAlert()
		}

    }).on('sendSuccess', function(id){
    	var index = warnings.indexOf(id)
	
		if (index>-1)
		{
			warnings.splice(index, 1)
			sendAlert()
		}

		else 
		{
			index = errors.indexOf(id)
			if (errors.indexOf(id)>-1)
			{
				errors.splice(index, 1)
				sendAlert()
			}
		}
    })
    
    monitors.push(monitor)
}

websites.forEach(function (website) {
    addMonitor(website)
})

//==================================================================
//use gc 
var gcHandle = null

var gc = global.gc || function() {
	clearInterval(gcHandle) 
	console.log("Unsupport gc")
}

gcHandle = setInterval(function () {gc()}, 60000)
