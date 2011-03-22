/**
 * Created by Rui Jiang.
 * Date: 3/9/11
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
            uploadObject: function(roomid, uploadMessageId) {
                return "/room/" + roomid + "/messages/" + uploadMessageId + "/upload.json";
            },
            join: function(roomId) { return "/room/" + roomId + "/join.json"; },
            leave: function(roomId) { return "/room/" + roomId + "/leave.json"; },
            lock: function(roomId) { return "/room/" + roomId + "/lock.json"; },
            unlock: function(roomId) { return "/room/" + roomId + "/unlock.json" }
        }
    };

    Camper.Executor = function(settings) {
        var options = {
            url: "",
            apikey: ""
        };

        options = $.extend(options, settings);

        var routes = Camper.Routes;

        //// Public functions
        this.rooms = {};

        this.rooms.listAll = function(callback) {
            execute(routes.rooms.listAll(), "GET", callback);
        };

        //// Private functions
        function execute(routeUrl, requestType, callback) {
            var dummyPasword = "x";
            var url = "https://" + options.apikey + ":" + dummyPasword + "@" + options.url + routeUrl;

            $.ajax({
                url: url,
                type: requestType,
                success: function(data) {
                    callback(data);
                },
                error: function(data) {
                    // todo: error function
                }
            });

        }
    };
})();