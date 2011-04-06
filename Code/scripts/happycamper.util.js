happycamper.util = function() {
    return {
        saveJson: function(key, json) {
            //console.log(json);
            localStorage.removeItem(key);
            localStorage[key] = JSON.stringify(json);
        },
        loadJson: function(key) {
            var value = localStorage[key];
            if (value === undefined || value === null)
                return null;

            return JSON.parse(value);
        },
        removeItem: function(key) {
            localStorage.removeItem(key);
        },
        MESSAGE_TYPES: {
            ENTER: "EnterMessage",
            LEAVE: "LeaveMessage",
            KICK: "KickMessage",
            WHO: "WhoMessage",
            TEXT: "TextMessage",
            PASTE: "PasteMessage",
            UPLOAD: "UploadMessage",
            TIMESTAMP: "TimestampMessage",
            LOCK: "LockMessage",
            UNLOCK: "UnlockMessage"
        }
    }
}();