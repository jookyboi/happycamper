/*
    jquery.hintbox.js

    Purpose:            Adds functionality to an input box to show and hide hints
                        to the user on focusIn and focusOut events.

    Version:            1.0.0
    Author:             Rui Jiang
    Email:              rjiang.bb@gmail.com
    Created:            3/28/2011
    Last-modified:      3/28/2011
    License:            Licensed under the MIT license.
*/

(function($) {
    $.fn.extend({
        hintbox: function(options) {
            var settings = {
                activeClass: "",
                filledClass: "",
                hintText: ""
            };
            
            settings = $.extend(settings, options);
            
            var $inputbox = $(this);
            $inputbox.val(settings.hintText)
                .removeClass(settings.filledClass)
                .removeClass(settings.activeClass);

            // attach events
            $inputbox.unbind("focusin").focusin(function() {
                $(this).removeClass(settings.filledClass);
                $(this).addClass(settings.activeClass);
                
                if ($(this).val() === settings.hintText) {
                    $(this).val("");
                }
            });
            
            $inputbox.unbind("focusout").focusout(function() {
                $(this).removeClass(settings.activeClass);
                
                if ($.trim($(this).val()) === "") {
                    $(this).val(settings.hintText);
                } else {
                    $(this).addClass(settings.filledClass);
                }
            });
            
            return this;
        }
    });
})(jQuery);