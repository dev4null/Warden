var request = require('request'),
    statusCodes = require('http').STATUS_CODES,
    events = require('events').EventEmitter,
    util = require('util'),
    appSettings = require('../settings')

/*
    Constructor
*/
function MonitorInfo (opts) {

/*
    setting params
*/
    this.active = true
    this.website = null
    this.url = null

    this.timeout = null
    this.warningTime = null
    
    this.useProxy = null
    this.proxyUrl = null

    this.useCredentials = null
    this.useDefaultCredentials = null
    this.userName = null
    this.userPassword = null
    
    this.sendAlert = null
    this.emailDefault = null
    this.alertEmail = null  
    this.errorForSend = null 
/*
    internal params
*/
    this.id = null  
    this.topError=[]
    this.topWarning=[]   
/*
    statistic params
*/
    this.avgResponseTime = 0
    this.succesCount = 0
    this.errorCount = 0
    this.warningCount = 0
    this.downTime = new Number('0')
    this.lastDownTime = new Number('0')
    this.runTime = new Number('0')
    this.minErrorTimeout = 5000
/*
    curent state 
*/
    this.responseTime = null
    this.reqestTime = null 
    this.lastSuccesTime = null
    this.lastErrorTime = null
    this.errorMessage = null
    this.state = 0   // 0 - ok; 1 - warning; 2 - error

    this.handle = null 

    this.init(opts)
}

/*
    Methods
*/

MonitorInfo.prototype.__proto__ = events.prototype;
 
MonitorInfo.prototype.init = function (opts) {
        var self = this
        self.url = opts.url
        self.website = opts.website || opts.url

        self.warningTime = opts.warningTime || appSettings.getData().warningTime
        self.timeout = (opts.timeout || appSettings.getData().timeOut) * 1000
       
        self.useProxy = opts.useProxy
        self.proxyUrl = opts.proxyUrl

        self.useCredentials =  opts.useCredentials
        self.useDefaultCredentials =  opts.useDefaultCredentials
        self.userName = opts.useDefaultCredentials ? appSettings.getData().userName : opts.userName
        self.userPassword = opts.useDefaultCredentials ? appSettings.getData().userPassword : opts.userPassword

        self.sendAlert = opts.sendAlert
        self.emailDefault = opts.emailDefault
        self.alertEmail = opts.emailDefault ? appSettings.getData().alertEmail : opts.alertEmail  
        self.errorForSend = opts.emailDefault ? appSettings.getData().errorForSend : opts.errorForSend 
       
        self.id=opts.id

        self.start()
    }

MonitorInfo.prototype.start =  function () {
        var self = this
            self.active=true
            self.reqestTime = self.lastSuccesTime = Date.now()
            self.handle = setInterval(function () {self.ping()}, self.timeout)
            self.ping()
        }

MonitorInfo.prototype.stop = function () {
        var self = this
        clearInterval(self.handle)
        self.handle = null
        self.active = false
        self.state = -1
        self.emit('sendSuccess',self.id)
    }

MonitorInfo.prototype.reloadDefault = function (setting) {
        var self = this

        if (self.useDefaultCredentials)
        {
            self.userName = setting.userName
            self.userPassword = setting.userPassword
        }

        self.timeout = setting.timeOut
        self.warningTime = setting.warningTime

        clearInterval(self.handle)
        self.handle = setInterval(function () {self.ping()}, self.timeout)

        //self.errorForSend = setting.errorForSend
        //self.sendAlert = setting.sendAlert

    }       

MonitorInfo.prototype.ping = function () {
        var self = this 
        if (self.active) 
        {
            var runTime = Date.now()
            try {
                var options = {
                        url: self.url,
                        proxy: self.useProxy ? self.proxyUrl : null,
                        auth: self.useCredentials ?  self. useDefaultCredentials  ? 
                                { 'user': appSettings.getData().userName, 'pass': appSettings.getData().password, 'sendImmediately': true } :
                                { 'user': self.userName, 'pass': self.userPassword, 'sendImmediately': true } : null,
                        headers: { 'User-Agent': 'request' }
                };

                request(options, function (error, res, body) {                   
                    if (!error && res.statusCode === 200) {
                        var currentTime = Date.now()
                        
                        self.responseTime = currentTime - runTime
                        self.avgResponseTime += self.responseTime                       
                        self.runTime += currentTime - self.reqestTime 
                        self.reqestTime = runTime
                        self.lastSuccesTime = currentTime

                        if (self.responseTime > self.warningTime)
                        {
                            self.isWarningFn()
                        }
                        else 
                        {
                            self.isOkFn()
                        }                  
                    }
     
                    else if (!error) {
                        self.errorMessage += res.statusCode ? res.statusCode : ''
                        self.isErrorFn(runTime)
                    }
     
                        else {
                            self.errorMessage = error ? error+'\n' : '' 

                            self.isErrorFn(runTime)
                        }
                })
            }
            catch (err) {
                self.isErrorFn(runTime)
            }
        }
    }

MonitorInfo.prototype.isOkFn = function () {
        var self = this

        self.succesCount++

        switch (self.state) {
            case 1:
                self.emit('sendSuccess',self.id)
                self.state = 0
               break
           case 2: 
                self.topError[0].downTime = self.lastDownTime
                self.lastDownTime = self.state = self.totalAlert = 0
                clearInterval(self.handle)
                self.handle = setInterval(function () {self.ping()}, self.timeout)
                self.emit('sendSuccess',self.id)
                break
           default:
                break
        }        
    }

MonitorInfo.prototype.isErrorFn = function (runTime) {
        var self = this
        var currentTime = Date.now()
        var time = currentTime - self.reqestTime
        self.runTime += time 
        self.lastDownTime+=time
        self.downTime+=time

        self.reqestTime = runTime

        if (self.state!=2)
        {
            self.errorCount++
            self.lastErrorTime = currentTime

            if (self.topError.length >= 25)
            {
                self.topError.pop()
            }

            self.topError.unshift({time: currentTime, text: self.errorMessage, downTime: 0,})

            clearInterval(self.handle)
            self.handle = setInterval(function () {self.ping()}, self.minErrorTimeout)
            self.emit('sendError',self.id)
            self.state = 2
        }
        else 
        {
            self.totalAlert++
            self.topError[0].downTime = self.lastDownTime

            /*

            if (self.sendAlert && self.totalAlert => self.errorForSend && appSettings.sendAlert)
            {
                sendAlert(self.alertEmail, self.errorMessage)
            }

            */
        }
    }

MonitorInfo.prototype.isWarningFn = function ()
    {
        var self = this

        self.warningCount++
        if (self.topWarning.length >= 25)
            {
                self.topWarning.pop()
            }

        self.topWarning.unshift({time: Date.now(), text: self.responseTime})
        
        switch (self.state) {
           case 0:
                self.emit('sendWarning', self.id)
                self.state = 1
                break
            case 1:
               break
           case 2:
                self.emit('sendWarning', self.id)
                self.state = 1
                self.topError[0].downTime = self.lastDownTime
                self.lastDownTime=0
                clearInterval(self.handle)
                self.handle = setInterval(function () {self.ping()}, self.timeout)
                
                /*

                if (self.sendAlert && self.totalAlert => self.errorForSend && appSettings.sendAlert)
                {
                    sendAlert(self.alertEmail, self.errorMessage)
                }

                */ 

                self.totalAlert=0
                break
           default:
                break
        } 
    }

MonitorInfo.prototype.getData = function()
    {
        var self = this
        var monitorInfoMini = 
        {
            id: self.id,
            website: self.website,
            url: self.url,
            active: self.active,
            responseTime: self.responseTime,
            avgResponseTime: Math.round(self.avgResponseTime/(self.succesCount+self.warningCount)),
            succesCount: self.succesCount,
            errorCount: self.errorCount,
            upTime: (Math.round(((100000 * (self.runTime - self.downTime)) / self.runTime)) / 1000) || 0  ,
            lastErrorTime: self.lastErrorTime,
            errorMessage: self.errorMessage,
            warningCount: self.warningCount,
            state : self.state,
            useProxy: self.useProxy,
            useCredentials: self.useCredentials,
            reqestTime: self.reqestTime
        }
        return monitorInfoMini
    }

    MonitorInfo.prototype.getDetail = function()
    {
        var self = this
        var monitorInfoMini = 
        {
            website: self.website,
            url: self.url,
            id: self.id,
            avgResponseTime: Math.round(self.avgResponseTime/(self.succesCount+self.warningCount)),
            upTime: (Math.round(((100000 * (self.runTime - self.downTime)) / self.runTime)) / 1000) || 0 ,
            downTime :self.downTime,
            topError : self.topError,
            topWarning : self.topWarning,
            runTime : self.runTime
        }
        return monitorInfoMini
    }

MonitorInfo.prototype.getSetting = function ()
    {
        var self = this
        var siteSetting =
            {
                id: self.id,
                active: self.active,
                url: self.url,                
                website: self.website,
                
                /*
                timeout: self.timeout/1000,
                warningTime: self.warningTime,
               
                sendAlert: self.sendAlert,
                alertEmail: self.alertEmail,
                emailDefault: self.emailDefault,
                errorForSend: self.errorForSend,
                */

                useProxy: self.useProxy,
                proxyUrl: self.proxyUrl,

                useDefaultCredentials: self.useDefaultCredentials,
                useCredentials: self.useCredentials,
                userName: self.userName,
                userPassword: self.userPassword

            }

        return siteSetting
    }

MonitorInfo.prototype.update = function (data) {
    var updateData = JSON.parse(JSON.stringify(data))
    var self = this

    self.url = updateData.url,                
    self.website = updateData.website,

/*
    self.timeout = updateData.timeout*1000,
    self.warningTime = updateData.warningTime,
               
    self.sendAlert = updateData.sendAlert,
    self.alertEmail = updateData.alertEmail,
    self.emailDefault = updateData.emailDefault,
    self.errorForSend = updateData.errorForSend,

*/
    self.useProxy = updateData.useProxy,
    self.proxyUrl = updateData.proxyUrl,

    self.useDefaultCredentials = updateData.useDefaultCredentials,
    self.useCredentials = updateData.useCredentials,
    self.userName = updateData.userName,
    self.userPassword = updateData.userPassword
}


module.exports = MonitorInfo