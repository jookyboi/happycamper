var happycamper = {};

happycamper.settings = {};
happycamper.state = {};

happycamper.rooms = function() {
    var visibleRooms = happycamper.state.visibleRooms;
    var activeRooms = happycamper.state.activeRooms;

    var $rooms = $("div.rooms");
    var $roomsList = $("div.rooms div.list");
    var $scrollbox = $roomsList.find("div.scrollbox");
    var $joining = $("div.content.joining");
    var $main = $("div.content.main");

    var ROOM_HEIGHT = 29;
    var MESSAGE_TYPES = {
        ENTER: "EnterMessage",
        LEAVE: "LeaveMessage",
        WHO: "WhoMessage",
        TEXT: "TextMessage",
        PASTE: "PasteMessage",
        TIMESTAMP: "TimestampMessage",
        LOCK: "LockMessage",
        UNLOCK: "UnlockMessage"
    };

    // on initialize
    templateRooms();
    openDefaultRoom();
    wireUpDownButtons();

    // templating
    function templateRooms() {
        $scrollbox.html("");

        templateActiveRooms();
        templateLockedRooms();
        templateInactiveRooms();

        wireOpenRoom();
        openDefaultRoom();
    }

    function templateActiveRooms() {
        $("#room-template").tmpl(activeRooms).appendTo($scrollbox);
    }

    function templateLockedRooms() {
        $("#room-template").tmpl(getLockedRooms()).appendTo($scrollbox);
    }

    function templateInactiveRooms() {
        $("#room-template").tmpl(getInactiveRooms()).appendTo($scrollbox);
    }

    // up down buttons
    function wireUpDownButtons() {
        if (!buttonsNecessary()) {
            return;
        }

        var scrollUp = $rooms.find("div.scroll-up");
        var scrollDown = $rooms.find("div.scroll-down");

        activateUpDownButtons();

        // prevent double binding
        scrollUp.unbind("click");
        scrollDown.unbind("click");

        // prevent double scrolling
        var upScrolling = false;
        var downScrolling = false;

        scrollUp.click(function() {
            if (!$(this).hasClass("active"))
                return;

            // prevent scrolling past the top
            var distanceToScroll = Math.min(-(scrollboxMarginTop()), (2* ROOM_HEIGHT));

            if (!upScrolling) {
                upScrolling = true;

                $scrollbox.animate({
                    marginTop: '+=' + distanceToScroll
                }, 300, function() {
                    upScrolling = false;
                    activateUpDownButtons();
                });
            }
        });

        scrollDown.click(function() {
            if (!$(this).hasClass("active"))
                return;

            // prevent scrolling past the end
            var distanceToBottom = -(scrollableDifference() - scrollboxMarginTop());
            var distanceToScroll = Math.min(distanceToBottom, 2 * ROOM_HEIGHT);

            if (!downScrolling) {
                downScrolling = true;

                $scrollbox.animate({
                    marginTop: '-=' + distanceToScroll
                }, 300, function() {
                    downScrolling = false;
                    activateUpDownButtons();
                });
            }
        });
    }

    function activateUpDownButtons() {
        var scrollUp = $rooms.find("div.scroll-up");
        var scrollDown = $rooms.find("div.scroll-down");

        if (topScrollable()) {
            scrollUp.addClass("active");
        } else {
            scrollUp.removeClass("active");
        }

        if (bottomScrollable()) {
            scrollDown.addClass("active");
        } else {
            scrollDown.removeClass("active");
        }
    }

    function topScrollable() {
        var marginTop = scrollboxMarginTop();
        return marginTop < 0;
    }

    function bottomScrollable() {
        return scrollboxMarginTop() > scrollableDifference();
    }

    // open room
    function wireOpenRoom() {
        $roomsList.find("div.room").click(function() {
            var $room = $(this);
            var roomId = $room.attr("roomid");

            if (!$room.hasClass("active")) {
                joinRoom(roomId);
            }
        });
    }

    function openDefaultRoom() {
        var state = happycamper.state;

        // user already has room open
        if (state.openRoomId !== -1) {
            openRoom(state.openRoomId);
            return;
        }

        // open first active
        var firstActiveRoom = jLinq.from(activeRooms).first();
        openRoom(firstActiveRoom.id);
    }

    function openRoom(roomId) {
        $main.show();
        makeRoomButtonActive(roomId);
        templateMessages(roomId);

        happycamper.state.openRoomId = roomId;
        happycamper.util.saveJson("state", happycamper.state);
    }

    function templateMessages(roomId) {
        var roomState = getRoomState(roomId);

        if (roomState === undefined)
            return;

        var messages = roomState.messages;

        var $conversationBox = $main.find("div.conversation");
        $conversationBox.html("");

        formatTimestampMessages(messages);
        console.log(messages);

        $.each(messages, function(index, message) {
            if (message.type === MESSAGE_TYPES.ENTER) {
                $("#enter-message-template").tmpl(message).appendTo($conversationBox);
            } else if (message.type === MESSAGE_TYPES.LEAVE) {
                $("#leave-message-template").tmpl(message).appendTo($conversationBox);
            } else if (message.type === MESSAGE_TYPES.TIMESTAMP) {
                $("#timestamp-message-template").tmpl(message).appendTo($conversationBox);
            } else if (message.type === MESSAGE_TYPES.TEXT) {
                insertWhoMessage(messages, message, index);
                $("#text-message-template").tmpl(message).appendTo($conversationBox);
            } else if (message.type === MESSAGE_TYPES.LOCK) {
                $("#lock-message-template").tmpl(message).appendTo($conversationBox);
            } else if (message.type === MESSAGE_TYPES.UNLOCK) {
                $("#unlock-message-template").tmpl(message).appendTo($conversationBox);
            }
        });

        scrollToConversationBottom();
    }

    function formatTimestampMessages(messages) {
        var timestampMessages = jLinq.from(messages)
            .where(function(message) {
                return message.type === MESSAGE_TYPES.TIMESTAMP;
            }).select();

        $.each(timestampMessages, function(index, message) {
            if (index === 0) {
                message.date = formatTimestampWithDate(message.created_at);
            } else {
                var lastTimeStamp = timestampMessages[index - 1].created_at;

                if (dateFormat(lastTimeStamp, "shortDate") !== dateFormat(message.created_at, "shortDate")) {
                    message.date = formatTimestampWithDate(message.created_at);
                }
            }
        });
    }

    function insertWhoMessage(messages, message, index) {
        var $conversationBox = $main.find("div.conversation");

        // add who message if text/paste is the firt of the block
        if (index === 0) {
            $("#who-message-template").tmpl(whoMessage(message.user)).appendTo($conversationBox);
        } else {
            var lastMessage = messages[index - 1];

            if ((lastMessage.type !== MESSAGE_TYPES.TEXT &&
                 lastMessage.type !== MESSAGE_TYPES.PASTE) ||
                (lastMessage.user_id !== message.user_id)) {
                $("#who-message-template").tmpl(whoMessage(message.user)).appendTo($conversationBox);
            }
        }
    }

    function whoMessage(user) {
        return {
            type: "WhoMessage",
            user_id: user.id,
            user: user
        };
    }

    function formatTimestampWithDate(time) {
        return dateFormat(time, "mmmm d");
    }

    function joinRoom(roomId) {
        
    }

    function makeRoomButtonActive(roomId) {
        $roomsList.find("div.room[roomid='" + roomId + "']").addClass("selected");
    }

    // utilities
    function scrollboxMarginTop() {
        return parseInt($scrollbox.css("marginTop").replace("px"));
    }

    function scrollableDifference() {
        return $roomsList.height() - $scrollbox.height();
    }

    function buttonsNecessary() {
        return $scrollbox.height() > $roomsList.height();
    }

    function getInactiveRooms() {
       var activeRoomIds = jLinq.from(activeRooms)
            .select(function(room) {
                return room.id;
            });

        return jLinq.from(visibleRooms)
            .where(function(room) {
                return ($.inArray(room.id, activeRoomIds) === -1 && !room.locked)
            }).select(function(room) {
                room.state = "inactive";
                return room;
            });
    }

    function getLockedRooms() {
        return jLinq.from(visibleRooms)
            .where(function(room) {
                // user could still enter a locked room
                return (room.locked &&
                        jLinq.from(activeRooms)
                            .where(function(activeRoom) {
                                return activeRoom.id === room.id;
                            }).count() === 0
                        );
            }).select(function(room) {
                room.state = "locked";
                return room;
            });
    }

    function getRoomState(roomId) {
        return jLinq.from(happycamper.state.activeRoomStates)
            .where(function(roomState) {
                return roomState.id === roomId;
            }).first();
    }

    function scrollToConversationBottom() {
        var $conversationBox = $main.find("div.conversation");
        $conversationBox.scrollTop($conversationBox[0].scrollHeight);
    }

    // public
    this.refreshRoom = function(roomId) {
        templateMessages(roomId);
    }
};

happycamper.refresh = function() {
    function getStateAndSettings() {
        happycamper.state = happycamper.util.loadJson("state");
        happycamper.settings = happycamper.util.loadJson("settings");
    }

    return {
        roomsList: function() {
            getStateAndSettings();
            happycamper.rooms();
        },
        room: function(roomId) {
            getStateAndSettings();
            happycamper.rooms().refreshRoom(roomId);
        }
    }
}();

happycamper.util = function() {
    return {
        saveJson: function(key, json) {
            localStorage.removeItem(key);
            localStorage[key] = JSON.stringify(json);
        },
        loadJson: function(key) {
            var value = localStorage[key];
            if (value === undefined || value === null)
                return null;

            return JSON.parse(value);
        }
    }
}();

var happycamperRooms;
$(function() {
    // use whatever is in the latest localStorage
    happycamper.state = happycamper.util.loadJson("state");
    happycamper.settings = happycamper.util.loadJson("settings");
    happycamper.rooms();

    // todo: handle getting kicked out of deleted room
});