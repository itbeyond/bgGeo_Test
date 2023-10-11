(function () {
   'use strict';

   angular.module('app').config(appConfig);
   appConfig.$inject = ['$stateProvider'];
   function appConfig($stateProvider) {

      $stateProvider
          .state('home', {
              url: '/home',
              controller: 'HomeController as homeCtrl'
          });

   }
})();