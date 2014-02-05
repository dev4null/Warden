'use strict'

var wardenApp = angular.module('wardenApp',['ngRoute','ui.bootstrap','ngResource'])

wardenApp.config(function($routeProvider, $locationProvider) {
  $routeProvider
    .when('/', { templateUrl: '/template/monitor.html', controller: 'monitorCntl' })
    .when('/settings', { templateUrl: '/template/setting.html', controller: 'settingCntl' })
    .when('/edit/:id', { templateUrl: '/template/edit.html', controller: 'editCntl' })
    .when('/add', { templateUrl: '/template/edit.html', controller: 'addCntl' })
    .when('/view/:id', { templateUrl: '/template/view.html', controller: 'viewCntl' })
    .otherwise({redirectTo: '/'})
    $locationProvider.html5Mode(true)
})


function MainCntl($scope, $route, $routeParams, $location) {
	$scope.errors = 0
	$scope.warnings = 0
    console.log($location.protocol()+'://'+$location.host()+':'+$location.port())
	var socket = io.connect('http://localhost:3000');
		socket.on('alert', function (data) {
			$scope.errors = data.error
			$scope.warnings = data.warning
			$scope.$apply();
		});
	console.log('main')

}

function viewCntl($scope, $route, $http, $location) {
  
  var getData = function() {
		$http.get('/detail/'+$route.current.params.id)
	        .success(function(data) {
				$scope.site = angular.fromJson(data)
				        	
	            })
	            .error(function(data, status) {

	            })
	}

	getData()

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
}


function addCntl($scope, $http, $location) {
  $scope.site = { 
		url: null,
		website: null,
		useDefaultCredentials: false,
		useCredentials: false,
		userName: null,
		userPassword: null
		}

	$scope.goPath = function ( path ) {
	  $location.path( path );
	};

	$scope.save=function(){

        $http({
		    method: 'POST',
		    url: '/add',
		    data: angular.toJson($scope.site)
		   //headers: {'Content-Type': 'application/json'}
			})
        .success(function(data, status, headers, config){ 
			$location.path( '/' );
	    })
	    .error(function(data, status, headers, config) {
	    });
	} 
  
}


function editCntl($scope, $route, $routeParams, $location, $http) {
   $scope.email=''

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

	            })
	}
	getData()

	$scope.goPath = function ( path ) {
	  $location.path( path );
	};

	$scope.save=function(){

        $http({
		    method: 'POST',
		    url: '/edit/'+$scope.site.id,
		    data: angular.toJson($scope.site)
		   //headers: {'Content-Type': 'application/json'}
			})
        .success(function(data, status, headers, config){ 
			$location.path( '/' );
	    })
	    .error(function(data, status, headers, config) {
	    });
	}

}

function monitorCntl($scope, $routeParams, $http, $timeout) {

	$scope.setActive = function(site)
	{
		var url = site.active ? 'stop': 'start'

		 $http.get('/'+url+'/'+site.id)
	        .success(function(data) {
	            })
	            .error(function(data, status) {
	            })
		
	}

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

	$scope.filter=''

	var getDataHandler= null

	var getData = function() {
		$http.get('/getdata')
	        .success(function(data) {
				$scope.sites = angular.fromJson(data)
	        	//console.log($scope.sites)
	        	getDataHandler = $timeout(function() {getData () }, 7500)
	            })
	            .error(function(data, status) {
	            	$timeout.cancel(getDataHandler)
	    			console.log('error end')
	            })
	        }

	getData()

	$scope.$on("$destroy", function(){
	    $timeout.cancel(getDataHandler)
	    console.log('end')
	})
}

function settingCntl($scope, $http, $location) {
	$scope.email=''

	var getData = function() {
		$http.get('/setting')
	        .success(function(data) {
				$scope.item = data
	            })
	            .error(function(data, status) {
	            })
	        }
	getData()

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

  	$scope.goPath = function ( path ) {
	  $location.path( path );
	};

	$scope.save=function(){

        $http({
		    method: 'POST',
		    url: '/setting',
		    data: angular.toJson($scope.item)
		   //headers: {'Content-Type': 'application/json'}
			})
        .success(function(data, status, headers, config){ 
			$location.path( '/' );
	    })
	    .error(function(data, status, headers, config) {
	    });
	}
    	
}

