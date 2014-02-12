'use strict'

var wardenApp = angular.module('wardenApp',['ngRoute','ui.bootstrap','ngResource','angular-growl'])

wardenApp.config(function($routeProvider, $locationProvider, $httpProvider) {
  
    var isLogin = function($q, $timeout, $http, $location){
      var deferred = $q.defer();
      $http.get('/auth').success(function(user){
        if (user !== '0')
          $timeout(deferred.resolve, 0);
        else {
          $timeout(function(){deferred.reject();}, 0);
          $location.url('/');
        }
      });
      return deferred.promise;
    };

	$httpProvider.responseInterceptors.push(function($q, $location) {
	      return function(promise) {
	        return promise.then(
	          function(response){
	            return response;
	          }, 
	          function(response) {
	            if (response.status === 401)
	              $location.url('/');
	            return $q.reject(response);
	          }
	        );
	      }
	    });

	$routeProvider
	    .when('/', { templateUrl: '/template/monitor.html', controller: 'monitorCntl'})
	    .when('/settings', { templateUrl: '/template/setting.html', controller: 'settingCntl', resolve: {auth: isLogin}})
	    .when('/edit/:id', { templateUrl: '/template/edit.html', controller: 'editCntl', resolve: {auth: isLogin}})
	    .when('/add', { templateUrl: '/template/edit.html', controller: 'addCntl', resolve: {auth: isLogin}})
	    .when('/view/:id', { templateUrl: '/template/view.html', controller: 'viewCntl'})
	    .when('/alerts', { templateUrl: '/template/alerts.html', controller: 'alertsCntl'})
	    //.otherwise({redirectTo: '/'})
    
    $locationProvider.html5Mode(true)

})
.run(function($rootScope,$http){
	
	var isLogin = function(){
      $http.get('/auth').success(function(user){
      	$rootScope.isAdmin = user !== '0'
      })
      .error(function(){
	      $rootScope.isAdmin = false;
	    });
    };

    isLogin()
})

wardenApp.controller('MainCntl',function ($scope, $http, $location, $modal, $rootScope, growl) {
	$scope.errors = 0
	$scope.warnings = 0
	$scope.dataLoad=null
	var socket = io.connect($location.protocol()+'://'+$location.host()+':'+$location.port());
		socket.on('alert', function (data) {
			$scope.errors = data.error
			$scope.warnings = data.warning
			$scope.dataLoad = !$scope.dataLoad || true
			$scope.$apply();
		});

	$scope.goPath = function ( path ) {
	  $location.path( path )
	};

	$scope.login = function () {

    var modalInstance = $modal.open({
      templateUrl: '/template/login.html',
      controller: 'loginCtrl'
    });

    modalInstance.result.then(function (usr) {
    	$http.post('/login', {
		      username: usr.name,
		      password: usr.pass
		    })
    	.success(function(user){
    		$rootScope.isAdmin=true
	    })
	    .error(function(){
	      growl.addErrorMessage("Failed login", {ttl: 7500});
	      $location.url('/');
	    });
    });

  };

  $scope.logout = function(){
  	  $scope.isAdmin=false
      $http.post('/logout');
    };

})

wardenApp.controller('loginCtrl', function ($scope, $modalInstance) {
	$scope.user = {
		name: null,
		pass: null
	}

  $scope.ok = function () {
    $modalInstance.close($scope.user);
  };

  $scope.cancel = function () {
    $modalInstance.dismiss('cancel');
  };
});

wardenApp.controller('alertsCntl', function ($scope, $http, growl) {
	var getData = function() {
		$http.get('/alert')
	        .success(function(data) {
				$scope.sites = angular.fromJson(data)				        	
	        })
	        .error(function(data, status) {
	        	growl.addErrorMessage("Failed to load data" + "("+status+")", {ttl: 7500});	
	         })
	}
	
	$scope.reload = function ()
	{
		getData()
	}

	getData()
})

wardenApp.controller('viewCntl', function ($scope, $route, $http, growl) {
  
  var getData = function() {
		$http.get('/detail/'+$route.current.params.id)
	        .success(function(data) {
				$scope.site = angular.fromJson(data)				        	
	        })
	        .error(function(data, status) {
	        	growl.addErrorMessage("Failed to load data" + "("+status+")", {ttl: 7500});	
	        })
	}

	$scope.runTimeFormat = function (date, milisec)
	{
		var str = moment.duration(date).months() != 0 ? moment.duration(date).months() + ' mon' : ''
			str += moment.duration(date).days() != 0 ? ' ' + moment.duration(date).days() + ' day': ''
			str += moment.duration(date).hours() != 0 ? ' ' + moment.duration(date).hours() + ' h': ''
			str += moment.duration(date).minutes() != 0 ? ' ' + moment.duration(date).minutes() + ' min': ''
			str += moment.duration(date).seconds() != 0 ? ' ' + moment.duration(date).seconds() + ' sec': ''

			str += milisec ? ' ' + moment.duration(date).milliseconds() + ' ms': '' 

		return str
	}

	$scope.dateFormat=function(date)
	{
		return moment(date).isValid() ? moment(date).format('HH:mm:ss.SS') : null
	}

	$scope.reload = function ()
	{
		getData()
	}

	getData()
})

wardenApp.controller('addCntl', function($scope, $http, growl) {
  $scope.site = { 
		url: null,
		website: null,
		useDefaultCredentials: false,
		useCredentials: false,
		userName: null,
		userPassword: null
	}

	$scope.save=function(){
        $http.post('/add', angular.toJson($scope.site))
        	.success(function(data, status, headers, config){ 
				$location.path( '/' );
	    	})
	    	.error(function(data, status, headers, config) {
	    		growl.addErrorMessage("Failed to save" + "("+status+")", {ttl: 7500});	
	    	});
	}  
})


wardenApp.controller('editCntl', function($scope, $route, $location, $http, growl) {
   $scope.email=''
   $scope.isEdit=true

   $scope.delEmail = function(i) {
    	$scope.site.alertEmail.splice(i, 1)
  	}

	 $scope.addEmail = function() {
	    $scope.site.alertEmail.push({text: $scope.email, id: $scope.alertEmail ? $scope.alertEmail.length : 0})
	    $scope.email=''
  	} 

   var getData = function() {
		$http.get('/monitor/'+$route.current.params.id)
	        .success(function(data) {
				$scope.site = angular.fromJson(data)

				if (!$scope.site.alertEmail)
				{
					$scope.site.alertEmail=[]
				}
				else 
				{
					var array = []
					$scope.site.alertEmail.forEach(function (email) {
						array.push({text: email.mail, id: array.length})
						})
					$scope.site.alertEmail = array
				}
					        	
	            })
	            .error(function(data, status) {
	            	growl.addErrorMessage("Failed to load data" + "("+status+")", {ttl: 7500});	
	            })
	}

	$scope.save=function(){
        $http.post('/edit/'+$scope.site.id, angular.toJson($scope.site))
        	.success(function(data, status, headers, config){ 
				$location.path( '/' );
	    	})
	    	.error(function(data, status) {
	    		growl.addErrorMessage("Failed to update" + "("+status+")", {ttl: 7500});	
	    	});
	}

	$scope.setActive = function()
	{
		$http.post($scope.site.active ? '/stop': '/start', {id: $scope.site.id})
	    	.success(function(data) {
	       		$location.path( '/' );
	    	})
	    	.error(function(data, status) {
	    		growl.addErrorMessage("Failed to change state" + "("+status+")", {ttl: 7500});	
	    	})
	}

	$scope.delete = function()
	{
		$http.post('/del', {id: $scope.site.id})
	        .success(function(data) {
	        	$location.path( '/' );
	    	})
	        .error(function(data, status) {
	        	growl.addErrorMessage("Failed to delete" + "("+status+")", {ttl: 7500});	
	        })
	}
	getData()
})

wardenApp.controller('monitorCntl', function ($scope, $http, growl) {

	$scope.filter=''

	$scope.getResponceTime = function (data)
	{
		var resTime = data.responseTime ? ' ('+data.responseTime+' ms)' : ''
		return moment(data.reqestTime).isValid() ? moment(data.reqestTime).format('HH:mm:ss.SS') + resTime  : null
	}

	$scope.dateFormat=function(date)
	{
		return moment(date).isValid() ? moment(date).format('HH:mm:ss.SS') : null
	}

	$scope.timeAgo = function(date)
	{
		return moment(date).isValid() ? moment(date).startOf('second').fromNow() : null
	}

	var getData = function() {
		$http.get('/getdata')
	        .success(function(data) {
				$scope.sites = angular.fromJson(data)
	            })
	            .error(function(data, status) {
	            	growl.addErrorMessage("Failed to load data"+ "("+status+")", {ttl: 7500});	
	            })
	        }

	var listerAlert = $scope.$watch('dataLoad', function(dataLoad) { if (dataLoad) {getData()} }, false);

	$scope.$on("$destroy", function(){
	    listerAlert ()
	})

	$scope.reload = function ()
	{
		getData()
	}

})

wardenApp.controller('settingCntl', function ($scope, $http, $location, growl) {
	$scope.email=''

	var getData = function() {
		$http.get('/setting')
	        .success(function(data) {
				$scope.item = data
	            })
	            .error(function(data, status) {
	            	growl.addErrorMessage("Failed to load setting"+ "("+status+")", {ttl: 7500});	
	            })
	        }
	
    $scope.addEmail = function() {
    	if ($scope.settingForm.inputEmail.$valid && $scope.email.length>0 )
    	{
	    	$scope.item.emails.push({name: $scope.email})
	    	$scope.email=''
		}
  	} 

  	$scope.delEmail = function(i) {
  		var index = $scope.item.emails.indexOf(i)
    	$scope.item.emails.splice(index, 1)
  	}

	$scope.save = function() {
        $http({ method: 'POST', url: '/setting',
		    	data: angular.toJson($scope.item)
			})
        .success(function(data, status){ 
			$location.path( '/' );
	    })
	    .error(function(data, status, headers, config) {
	    	growl.addErrorMessage("Failed to save " + "("+status+")", {ttl: 7500});	
	    });
	}

	getData()
})


wardenApp.directive('login', function() {
     return function($rootScope, element, attr) { 
     	$rootScope.$watch('isAdmin', function(isAdmin) {
               element.css({ display: isAdmin ? 'initial' : 'none' });
            }, true);  	
    };
  })

wardenApp.directive('public', function() {
     return function($rootScope, element, attr) { 
     	$rootScope.$watch('isAdmin', function(isAdmin) {
               element.css({ display: isAdmin ? 'none' : 'initial' });
            }, true);
    };
  });


