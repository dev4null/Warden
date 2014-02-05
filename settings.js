
function appSetting () {

    this.timeOut = 15
    this.warningTime = 1200
    this.sendAlert = false
    this.userName = 'user'
    this.password = 'pass'
    this.errorForSend = 3
    this.minErrorTimeout=5000
    this.useDataBase = false
    this.emails = [ {name: 'admin@root.ru'} ]
}

appSetting.prototype.getData = function ()
    {
        var self = this

        var data = {
            timeOut: self.timeOut,
            warningTime: self.warningTime,
            sendAlert: self.sendAlert,
            userName: self.userName,
            password: self.password,
            errorForSend: self.errorForSend,
            minErrorTimeout: self.minErrorTimeout,
            emails: self.emails
        }
    return data 

    }

appSetting.prototype.update = function (data)
    {
        var updateData = JSON.parse(JSON.stringify(data))
        var self = this

        self.timeOut=updateData.timeOut
        self.warningTime = updateData.warningTime
        self.sendAlert = updateData.sendAlert
        self.userName = updateData.userName
        self.password = updateData.password
        self.errorForSend = updateData.errorForSend
       // self.minErrorTimeout = updateData.minErrorTimeout
        self.emails=[]

        updateData.emails.forEach(function (email) {
            self.emails.push({name: email.name})
        })
    }

appSetting.instance = null;
 

appSetting.getInstance = function(){
    if(this.instance === null){
        this.instance = new appSetting();
    }
    return this.instance;
}
 
module.exports = appSetting.getInstance();

