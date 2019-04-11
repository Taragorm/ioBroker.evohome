/*
    ioBroker.vis vistaragorm Widget-Set

    version: "0.0.1"

    Copyright 2019 Taragorm taragorm@zoho.eu
*/
"use strict";

// add translations for edit mode
$.get( "adapter/evohome/words.js", function(script) {
    let translation = script.substring(script.indexOf('{'), script.length);
    translation = translation.substring(0, translation.lastIndexOf(';'));
    $.extend(systemDictionary, JSON.parse(translation));
});



vis.binds["evohome_zone"] = {
    version: "0.0.1",
    
    showVersion: function () {
        if (vis.binds["evohome_zone"].version) {
            console.log('Version evohome_zone: ' + vis.binds["evohome_zone"].version);
            vis.binds["evohome_zone"].version = null;
        }
    },
    
    //--------------------------------------------------------------------
    /**
    	Schedule lookup to shorten mode text - needs language support someday
     */
    shortModes : {
	     "FollowSchedule":"Scheduled"
	     
    },
    //--------------------------------------------------------------------
    /**
    	Update the HTML with live data.
    	
    	@param $div 	Div that is the widget
    	@param data 	Widget attribute data (i.e. configuration)
    	@param vjson	Value state as JSON
     */
    setValues: function($div, data, vjson) {
        
        //console.log("setvalues v=",vjson);
        
        const v = JSON.parse(vjson);
        const mv = v.temperature;
        const sp = v.setpoint;
        
        
        const fmt = data.format || "%.1f &deg;C";
    

        $div.find('.vis_evohome_zone-mv').html( taragorm_common.format(fmt, mv) );
        $div.find('.vis_evohome_zone-sp').html( taragorm_common.format(fmt, sp) );
                
        var vect = taragorm_common.getColourVector(data.colours);
        var mvcols = taragorm_common.getColours(mv, vect, data.interpolate);
        var spbg = taragorm_common.getBackground(sp, vect, data.interpolate);
        $div.find('.vis_taragorm_zone-table').css({ "background": "radial-gradient("+ mvcols.b+", "+ spbg + ")", "foreground-color": mvcols.f } );                            
        $div.find('.vis_evohome_zone-mode').html( this.shortModes[v.setpointMode] || v.setpointMode  ); 
        $div.find('.vis_evohome_zone-fault').html( this.faults.join()  ); 
    },
    
    
    //--------------------------------------------------------------------
    /**
    	Widget creation factory
     */
    createWidget: function (widgetID, view, data, style) {
        try {
            var $div = $('#' + widgetID);
            // if nothing found => wait
            if (!$div.length) {
                return setTimeout(function () {
                    vis.binds["evohome_zone"].createWidget(widgetID, view, data, style);
                }, 100);
            }
            
            //console.log("Create mvsp");
    		var title = data.titleText.trim();
    		if(!title) {
    			let frags = data.zone_oid.split(".");
    			title = frags[frags.length-2];
    		}
    
    		var zone = data.zone_oid + ".val";
    
            var text = '';
            text += "<table width='100%' height='100%' class='vis_evohome_zone-table' style='background-color:#00ff00'>";
            text += "<tr><th>" + title + "</th></tr>";
            text += "<tr><td><span class='vis_evohome_zone-mv'></span></td></th>";
            text += "<tr><td><span class='vis_evohome_zone-sp'></span></td></th>";
            text += "<tr><td><span class='vis_evohome_zone-mode'></span></td></th>";
            text += "<tr><td><span class='vis_evohome_zone-fault'></span></td></th>";
            text += "</table>";
            
            $('#' + widgetID).html(text);
    
            
            this.setValues(
                            $div, 
                            data, 
                            vis.states[ zone ]
                            );
            
            let self = this;
            // subscribe on updates of values
            let bound = [];
            let handlers = [];
            
            if(data.zone_oid) {
                bound.push( zone );
                handlers.push(this.setValues);
                vis.states.bind(zone, function (e, newVal, oldVal) {
                    self.setValues($div, data, newVal );
                });                
            }
    
            if(bound.length) {
                $div.data('bound', bound);
                $div.data('bindHandler', handlers);
            }
            
        } catch(ex) {
            console.error(ex);
        }
    }
    //--------------------------------------------------------------------
    
};

vis.binds["evohome_zone"].showVersion();


