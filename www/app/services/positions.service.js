/*jshint loopfunc: true */
(function () {
    'use strict';

    angular.module('app').factory('positions', positions);
    positions.$inject = ['$q', '$rootScope', '$timeout'];
    function positions($q, $rootScope, $timeout) {
        let positions_maxHeartbeat = 900000, showlogs = true, active_startby = { mapping: false, eotrackme: false, navmode: false },
            currentActivityState, lastHeading = 0, bggeo_activity_events = [], bgwatchactive = false, positions_activeWatchWatcher = null,
            positions_lastpos = JSON.parse(window.localStorage.getItem("position_lastlocation")) || { coords: { speed: 0, heading: 0, accuracy: 100, latitude: -23.6975, longitude: 133.8836, altitude: 0 }, timestamp: Date.now() - (positions_maxHeartbeat + 1) },
            service = {
                init: positions_init,
                currentLocation: $rootScope.currentLocation,
                get: positions_getPosition,
                lastpos: positions_lastpos,
                started: false
            };

        $rootScope.altitudeAdjusted = 0;
        $rootScope.currentLocation = positions_lastpos;
        $rootScope.$on('onPause', onPause);
        $rootScope.$on('onResume', onResume);

        return service;


        function onPause() {
            if (service.started) positions_activeWatch_stop("mapping");
        }

        function onResume() {
            if (service.started) {
                positions_getPosition(true, false);
                positions_activeWatch("mapping");
            }
        }

        function positions_getPosition(force, persist) {
            var defer = $q.defer();

            if (!service.started) {
                console.log("Calling positions_getPosition: bgGeo_notstarted");
                $timeout(function () { defer.resolve(positions_getPosition(force, persist).then(function (po) { return po; })); }, 1000);
            } else {
                if (typeof $rootScope.currentLocation.coords !== 'undefined' && !force) { defer.resolve($rootScope.currentLocation); } else {
                    console.log("Calling positions_getPosition: force: " + force + " - persist: " + persist);
                    window.BackgroundGeolocation.getCurrentPosition({ maximumAge: 0, timeout: 120, persist: persist }, function (location) {
                        defer.resolve(location);
                    }, positions_onlocationError);
                }
            }
            return defer.promise;
        }


        function positions_onlocation(location) {
            console.log('bg: onlocation - lat: ' + location.coords.latitude + '  lng: ' + location.coords.longitude + '  hdr: ' + location.coords.heading + '  alt: ' + location.coords.altitude || 0);
        }

        function positions_onActivityChange(activityName) {
            console.log("Activity has just changed to " + activityName);
        }

        function positions_onlocationError(err) {
            console.log('onlocationError' + err);
        }

        function positions_changePace() {
            let us = service.isMoving === 1 ? false : true;
            window.BackgroundGeolocation.changePace(us);
        }

        function positions_onMotionChange(MotionChangeEvent) {
            if (showlogs) console.log('positions.service - positions_onMotionChange: ' + JSON.stringify(MotionChangeEvent));
            // timeout to ensure status icon update is digested
            $timeout(function () { service.isMoving = MotionChangeEvent.isMoving ? 1 : 2; });

            if (!service.started) return;
            if (!MotionChangeEvent.isMoving && active_startby.mapping && bgwatchactive) // We have stopped moving pause the activewatch if running
                window.BackgroundGeolocation.stopWatchPosition(function () {
                    bgwatchactive = false;
                    if (showlogs) console.log('bgGeo stopWatchPosition due to not moving: success');
                    $timeout(function () { $rootScope.$broadcast('positions_stoppedmoving'); }, 500);
                }, function (e) {
                    if (showlogs) console.log('bgGeo stopWatchPosition due to not moving: failed', e);
                });
            else if (MotionChangeEvent.isMoving && active_startby.mapping && !bgwatchactive)
                window.BackgroundGeolocation.watchPosition(function (location) {
                    bgwatchactive = true;
                    if (showlogs) console.log('bgGeo WatchPosition due to moving: success');
                }, positions_onlocationError, {
                        interval: 500,
                        persist: false
                    });
            else {
                if (showlogs) console.log('bgGeo No action required bgwatchactive = ' + bgwatchactive);
            }
        }

        function positions_activeWatch() {
            let defer = $q.defer();
            if (!service.started) {
                $timeout(function () { defer.resolve(positions_activeWatch().then(function (po) { return po; })); }, 1000);
            } else {
                if (service.activeWatchRunning === true || $rootScope.positions_permissions === "None") {
                    defer.resolve();
                } else {
                    service.activeWatchRunning = true;

                    if (showlogs) console.log('bgGeo add onMotionChange');
                    bggeo_activity_events.push(window.BackgroundGeolocation.onMotionChange(positions_onMotionChange, function (e) {
                        if (showlogs) console.log('ERROR: bgGeo onMotionChange: ', JSON.stringify(e));
                    }));

                    let config = {
                        'isMoving': true,
                        'distanceFilter': 50
                    };
                    if (showlogs) console.log('bgGeo setConfig: ' + JSON.stringify(config));
                    window.BackgroundGeolocation.setConfig(config, function (state) {
                        if (showlogs) console.log('bgGeo setConfig - success: ' + JSON.stringify(state));

                        if (showlogs) console.log('bgGeo if ' + bgwatchactive + ' = false then watchPosition');
                        window.BackgroundGeolocation.watchPosition(function (location) {
                            bgwatchactive = true;
                            if (showlogs) console.log('bgGeo watchPosition: success');
                        }, positions_onlocationError, {
                                interval: 2000,
                                persist: false
                            });
                        window.BackgroundGeolocation.changePace(true);
                    });

                    $timeout(function () { service.isMoving = 1; });
                    defer.resolve();
                }
            }
            return defer.promise;
        }

        function positions_activeWatch_stop(startedby) {
            let defer = $q.defer();

            if (!service.started) {
                $timeout(function () { defer.resolve(positions_activeWatch_stop(startedby).then(function (po) { return po; })); }, 1000);
            } else {

                bggeo_activity_events.forEach((evt) => {
                    if (showlogs) console.log('bgGeo removing event listeners' + JSON.stringify(evt));
                    evt.remove();
                });
                bggeo_activity_events = [];

                window.BackgroundGeolocation.stopWatchPosition(function () {
                    bgwatchactive = false;
                    if (showlogs) console.log('bgGeo watchPosition stopped success');
                    $timeout(function () { service.isMoving = 0; });
                }, function (e) {
                    if (showlogs) console.log('bgGeo watchPosition stopped failed', e);
                });
                service.activeWatchRunning = false;
                $timeout(function () { service.isMoving = 0; });

                defer.resolve();
            }
            return defer.promise;
        }

        function positions_init() {
            if (!$rootScope.platform) { setTimeout(function () { positions_init(); }, 1000); return; }

            var config = { "url": "", "method": "POST", "autoSync": "false", "batchSync": "false", "maxDaysToPersist": 0, "maxRecordsToPersist": 0, "maxBatchSize": 50, "stopOnTerminate": "true", "startOnBoot": "false", "stopTimeout": 1, "activityRecognitionInterval": 10000, "debug": "false", "logLevel": 4, "deferTime": 0, "disableElasticity": "false", "heartbeatInterval": 900, "desiredAccuracy": 0, "distanceFilter": 10, "stationaryRadius": 20, "activityType": "OtherNavigation", "stopDetectionDelay": 0, "useSignificantChangesOnly": "false", "disableMotionActivityUpdates": "false", "locationUpdateInterval": 10000, "fastestLocationUpdateInterval": 15000, "triggerActivities": "in_vehicle, on_bicycle, running, walking, on_foot", "forceReloadOnBoot": "false", "forceReloadOnMotionChange": "false", "forceReloadOnLocationChange": "false", "forceReloadOnGeofence": "false", "forceReloadOnHeartbeat": "false", "notification": { "title": "GPS Map & Navigation Service", "text": "Location Monitoring Active" } };

            window.BackgroundGeolocation.onLocation(positions_onlocation, positions_onlocationError);
            window.BackgroundGeolocation.onHeartbeat(function (params) {
                console.log('bg: onHeartbeat: ' + JSON.stringify(params));
            }, function (error) {
                console.log('bg: onheartbeat Error: ' + JSON.stringify(error));
            });
            window.BackgroundGeolocation.onActivityChange(positions_onActivityChange, function (error) {
                console.log('bg: onActivityChange failure - ', JSON.stringify(error));
            });

            config.notification = { 'title': 'GPS Map & Navigation Service', 'text': 'Location Monitoring Active' };
            console.log(JSON.stringify(config));
            console.log('bgGeo.ready()');
            window.BackgroundGeolocation.ready(config, function (state) {
                console.info('bgGeo ready success: ' + JSON.stringify(state));
                if (!state.enabled) {
                    window.BackgroundGeolocation.start(function () {
                        console.log('bgGeo.start()');
                        $timeout(function () {
                            console.log('bgGeo.start'); service.started = true; $rootScope.$broadcast('positions_bggeostart');

                            positions_activeWatch();
                        }, 1000);
                    }, function (error) {
                        console.log('bgGeo.start error: ' + error);
                    });
                } else {
                    $timeout(function () { console.log('bgGeo.start enabled'); service.started = true; $rootScope.$broadcast('positions_bggeostart'); }, 1000);
                }
            }, function (error) {
                console.log('bgGeo.config error: ' + error);
            });

        }
    }
})();