/*
    Do not use. Only half of functions implemented.
*/

var Camper = Camper || {};

(function() {
    // Routes based on API docs @ http://developer.37signals.com/campfire/index
    Camper.Routes = {
        rooms: {
            listAll: function() { return "/rooms.json"; },
            presentRooms: function() { return "/presence.json"; },
            show: function(roomId) { return "/room/" + roomId + ".json"; },
            uploadFile: function(roomId) { return "/room/" + roomId + "/uploads.json"; },
            update: function(roomId) { return "/room/#" + roomId + ".json"; },
            recentMessages: function(roomId) { return "/room/" + roomId + "/recent.json"; },
            recentUploads: function(roomId) { return "/room/" + roomId + "/uploads.json"; },
            getUploadObject: function(roomid, uploadMessageId) {
                return "/room/" + roomid + "/messages/" + uploadMessageId + "/upload.json";
            },
            join: function(roomId) { return "/room/" + roomId + "/join.json"; },
            leave: function(roomId) { return "/room/" + roomId + "/leave.json"; },
            lock: function(roomId) { return "/room/" + roomId + "/lock.json"; },
            unlock: function(roomId) { return "/room/" + roomId + "/unlock.json" },
            speak: function(roomId) { return "/room/" + roomId + "/speak.json"; }
        },
        users: {
            show: function(userId) { return "/users/" + userId + ".json"; },
            showAuthenticatedUser: function() { return "/users/me.json"; }
        },
        search: function(term) { return "/search/" + encodeURIComponent(term) + ".json"; }
    };

    Camper.Executor = function(settings) {
        var options = {
            url: "",
            apikey: ""
        };

        options = $.extend(options, settings);

        var routes = Camper.Routes;

        //// Public functions

        // rooms
        this.rooms = {};

        this.rooms.listAll = function(callback) {
            execute(routes.rooms.listAll(), "GET", {}, callback);
        };

        this.rooms.presentRooms = function(callback) {
            execute(routes.rooms.presentRooms(), "GET", {}, callback);
        };

        this.rooms.show = function(roomId, callback) {
            execute(routes.rooms.show(roomId), "GET", {}, callback);
        };

        this.rooms.recentMessages = function(roomId, arguments, callback) {
            execute(routes.rooms.recentMessages(roomId), "GET", arguments, callback);
        };

        this.rooms.recentUploads = function(roomId, callback) {
            execute(routes.rooms.recentUploads(roomId), "GET", {}, callback);
        };

        this.rooms.getUploadObject = function(roomId, uploadMessageId, callback) {
            execute(routes.rooms.getUploadObject(roomId, uploadMessageId), "GET", {}, callback);
        };

        this.rooms.join = function(roomId, callback) {
            execute(routes.rooms.join(roomId), "POST", {}, callback);
        };

        this.rooms.speak = function(roomId, arguments, callback) {
            execute(routes.rooms.speak(roomId), "POST", arguments, callback);
        };

        // users
        this.users = {};

        this.users.show = function(userId, callback) {
            execute(routes.users.show(userId), "GET", {}, callback);  
        };

        // search
        this.search = function(term, callback) {
            execute(routes.search(term), "GET", {}, callback);
        };

        //// Private functions
        function execute(routeUrl, requestType, data, callback) {
            var dummyPasword = "x";
            var url = "https://" + options.apikey + ":" + dummyPasword + "@" + options.url + routeUrl;
            var successCalled = false;

            $.ajax({
                url: url,
                data: data,
                type: requestType,
                success: function(data) {
                    successCalled = true;
                    callback(data);
                },
                error: function(data) {
                    // todo: error function
                },
                complete: function(jqXHR, textStatus) {
                    // success doesn't get called with an empty response
                    // this is needed for join to function correctly
                    if (!successCalled) {
                        callback(data);
                    }
                }
            });

        }
    };
})();