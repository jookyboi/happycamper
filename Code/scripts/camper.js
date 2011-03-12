/**
 * Created by Rui Jiang.
 * Date: 3/9/11
 */

var Camper = Camper || {};

(function() {
    // Routes based on API docs @ http://developer.37signals.com/campfire/index
    Camper.Routes = {
        rooms: {
            listAll: function() { return "/rooms.xml"; },
            presentRooms: function() { return "/presence.xml"; },
            show: function(roomId) { return "/room/" + roomId + ".xml"; },
            uploadFile: function(roomId) { return "/room/" + roomId + "/uploads.xml"; },
            update: function(roomId) { return "/room/#" + roomId + ".xml"; },
            recentMessages: function(roomId) { return "/room/" + roomId + "/recent.xml"; },
            recentUploads: function(roomId) { return "/room/" + roomId + "/uploads.xml"; },
            uploadObject: function(roomid, uploadMessageId) {
                return "/room/" + roomid + "/messages/" + uploadMessageId + "/upload.xml";
            },
            join: function(roomId) { return "/room/" + roomId + "/join.xml"; },
            leave: function(roomId) { return "/room/" + roomId + "/leave.xml"; },
            lock: function(roomId) { return "/room/" + roomId + "/lock.xml"; },
            unlock: function(roomId) { return "/room/" + roomId + "/unlock.xml" }
        }
    };

    Camper.Executor = function(settings) {
        var options = {
            user: "",
            apikey: ""
        };

        options = $.extend(options, settings);

        var apiUri = 'https://' + user + '.campfirenow.com';

        //// Public functions

        //// Private functions
        function execute(request) {
            if (options.user === "") {

            }
        }

        //// Helper objects
        var request = function(route, options) {

        };
    };
})();