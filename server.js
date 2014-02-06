var express = require('express')
var http = require('http')
var path = require('path')
var socket = require('socket.io')

var app = express() 

var MonitorInfo = require('./core/ping')
var websites = require('./websites')
var appSettings = require('./settings')

var monitors = [],
    errors = [],
    warnings =[]


app.set('port', process.env.PORT || 3000)
app.use(express.favicon())
//app.use(express.logger('dev'))
app.use(express.json())
app.use(express.urlencoded())
app.use(express.methodOverride())
app.use(express.cookieParser('your secret here'))
app.use(express.session())
app.use(app.router)
app.use(express.static(path.join(__dirname, 'public')))

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler())
}

app.get('/getdata', function(req, res, next) {
	res.writeHead(200, {"Content-Type": "application/json"})
	var monitorsMini=[]
  	monitors.forEach(function (monitorInfo) {
  		monitorsMini.push(monitorInfo.getData())
	})
  	var info = JSON.stringify(monitorsMini)
  	res.write(info)
  	res.end() 
})

app.get('/monitor/:id*', function(req, res, next) {
	var info = getMonitorById(req.param('id'))
	
	if (info!=undefined)
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


app.get('/detail/:id*', function(req, res, next) {

	if (!appSettings.getData().useDataBase)
	{
		var info = getMonitorById(req.param('id'))
		
		if (info!=undefined)
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

app.get('/stop/:id*', function(req, res, next) {
	var monitor = getMonitorById(req.param('id'))

	if (monitor)
	  {
	  	monitor.stop()
	  	res.writeHead(200, {"Content-Type": "text/html"})
	  	res.end()
	  }
	else 
	  {
	  	res.writeHead(404, {"Content-Type": "text/html"})
	  	res.end()
	  }
})

app.get('/start/:id*', function(req, res, next) {
	var monitor = getMonitorById(req.param('id'))
	if (monitor)
	  {
	  	monitor.start()
	  	res.writeHead(200, {"Content-Type": "text/html"})
	  	res.end()
	  }
	else 
	  {
	  	res.writeHead(404, {"Content-Type": "text/html"})
	  	res.end()
	  }
})


app.get('/setting', function(req, res, next) {
	
	res.writeHead(200, {"Content-Type": "application/json"})
	res.write(JSON.stringify(appSettings.getData()))
	res.end()
	 
})

app.post('/setting', function(req, res, next){
	
	appSettings.update(req.body)

  	monitors.forEach(function (monitorInfo) {
  		monitorInfo.reloadDefault(appSettings.getData())
  	})

	res.writeHead(200, {"Content-Type": "text/html"})
	res.end()

});


app.post('/edit/:id*', function(req, res, next){

	var monitor = getMonitorById(req.param('id'))
	if (monitor)
	  {
	  	monitor.update(req.body)
	  	res.writeHead(200, {"Content-Type": "text/html"})
	  }
	else 
	  {
	  	res.writeHead(404, {"Content-Type": "text/html"})
	  }
	  res.end()
});

app.post('/add', function(req, res, next){
	addMonitor(req.body)
	res.writeHead(200, {"Content-Type": "text/html"})
	res.end()
});


app.use(function(req, res) {
	res.sendfile(__dirname + '/public/index.html')
})


function getMonitorById(value)
{
	var result  = monitors.filter(function(o){return o.id == value} )
  	return result? result[0] : null 
} 

var server = http.createServer(app).listen(app.get('port'), function(){
  	console.log('Express server listening on port ' + app.get('port'))
})

var io = socket.listen(server)
io.set('log level', 1)

function addMonitor(data)
{
	var monitor = new MonitorInfo ({
        url: data.url,
        website: data.website,

        timeout: data.timeout,
        warningTime: data.warningTime,
        
        id: data.id || monitors.length,

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

			io.sockets.emit('alert', { error: errors.length, warning: warnings.length })
		}
		
    }).on('sendWarning', function(id){
    	if (warnings.indexOf(id) == -1)
		{
			warnings.push(id)

			if (errors.indexOf(id) >-1)
			{
				errors.splice(errors.indexOf(id), 1)
			}

			io.sockets.emit('alert', { error: errors.length, warning: warnings.length })
		}

    }).on('sendSuccess', function(id){
    	var index = warnings.indexOf(id)
	
		if (index>-1)
		{
			warnings.splice(index, 1)
			io.sockets.emit('alert', { error: errors.length, warning: warnings.length }
			)
		}

		else 
		{
			index = errors.indexOf(id)
			if (errors.indexOf(id)>-1)
			{
				errors.splice(index, 1)
				io.sockets.emit('alert', { error: errors.length, warning: warnings.length })
			}
		}
    })
    
    monitors.push(monitor)
}

websites.forEach(function (website) {
    addMonitor(website)
})

io.sockets.on('connection', function(socket) {
 	io.sockets.emit('alert', { error: errors.length, warning: warnings.length })
})


