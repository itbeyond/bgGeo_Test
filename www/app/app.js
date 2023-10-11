// Ionic Starter App
(function () {
   'use strict';

   angular.module('app', ['ionic']).run(appRun);
   appRun.$inject = ['$ionicPlatform','$rootScope', 'positions'];
   function appRun($ionicPlatform, $rootScope, positions) {

      $ionicPlatform.ready(function () {

          console.log(new Date() + " Device.Ready");

         document.addEventListener("pause", function () { $rootScope.$broadcast('onPause'); });
         document.addEventListener("resume", function () { $rootScope.$broadcast('onResume'); });

         switch (ionic.Platform.platform()) {
            case "android":
               $rootScope.platform = "android";
               break;
            case "ios":
               $rootScope.platform = "ios";
               break;
            case "edge":
               $rootScope.platform = "uwp";
               break;
            default:
               $rootScope.platform = "windows";
               break;
         }
         $rootScope.$broadcast("PlatformReady");
         positions.init();

      });
   }

})();