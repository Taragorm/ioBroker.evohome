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

        @param ctx      Context object
    	@param vjson	Value state as JSON
     */
    setValues: function(ctx, vjson) {
        
        //console.log("setvalues v=",vjson);
        
        const v = JSON.parse(vjson);
        ctx.mv = v.temperature;
        ctx.sp = v.setpoint;
            
        ctx.div.find('.vis_evohome_zone-mv').html( taragorm_common.format(ctx.fmt, ctx.mv) );
        ctx.div.find('.vis_evohome_zone-sp').html( taragorm_common.format(ctx.fmt, ctx.sp) );
                
        var vect = taragorm_common.getColourVector(ctx.data.colours);
        var mvcols = taragorm_common.getColours(ctx.mv, vect, ctx.data.interpolate);
        var spbg = taragorm_common.getBackground(ctx.sp, vect, ctx.data.interpolate);
        ctx.div.find('.vis_evohome_zone-table').css({ "background": "radial-gradient("+ mvcols.b+", "+ spbg + ")", "foreground-color": mvcols.f } );                            
        ctx.div.find('.vis_evohome_zone-mode').html( this.shortModes[v.setpointMode] || v.setpointMode  ); 
        //$div.find('.vis_evohome_zone-fault').html( v.faults.join()  ); 
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
            
            var ctx = { 
                    "data": data, 
                    "div": $div, 
                    "fmt": data.format || "%.1f &deg;C"
                };

            $div.prop("$ctx",ctx);

            //console.log("Create mvsp");
    		var title = data.titleText.trim();
    		if(!title) {
    			let frags = data.zone_oid.split(".");
    			title = frags[frags.length-2];
    		}
            
    		var zone = data.zone_oid + ".val";
    
            var text = `
<table width='100%' height='100%' class='vis_evohome_zone-table' style='background-color:#00ff00'>
<tr><th>${title}</th></tr>
<tr><td><span class='vis_evohome_zone-mv'></span></td></th>
<tr><td><span class='vis_evohome_zone-sp'></span></td></th>
<tr><td><a class='vis_evohome_zone-mode'></a></td></th>
<tr><td><span class='vis_evohome_zone-fault'></span></td></th>
</table>
<div id='${widgetID}-dialog' title='Zone ${title} control'>
    <div class="temp-slider">
    <div class="custom-handle ui-slider-handle"></div>
    </div> 
    <a id='${widgetID}-apply'>Apply</a>
</div>
`;
            
            $('#' + widgetID).html(text);

            function findId(id) { return $div.find("#"+widgetID+id); }

            ctx.slider_handle = $div.find(".custom-handle");
            ctx.temp_slider = $div.find(".temp-slider").slider({
                min: 10, max: 30, step: 0.5,
                create: function() {
                    ctx.slider_handle.text( $( this ).slider( "value" ) );
                },
                change: function( event, ui ) {
                    ctx.sel_sp = ui.value;
                    ctx.slider_handle.text( ui.value );
                },
                slide: function( event, ui ) {
                    ctx.sel_sp = ui.value;
                    ctx.slider_handle.text( ui.value );
                }
              });


            findId("-apply")
              .button()
              .click( () => this._onApply(ctx) )
              ;

            ctx.dialog = findId("-dialog")
                        .dialog({
                            autoOpen: false
                        });

            $div.find('.vis_evohome_zone-mode')
                        .button()
                        .click( () => this._openModeDialog(ctx) )
                        ;

            this.setValues(
                            ctx,
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
                    self.setValues(ctx, newVal );
                });                
            }
    
            if(bound.length) {
                $div.data('bound', bound);
                $div.data('bindHandler', handlers);
            }
            
            //console.log("Set cmd");
            //vis.setValue(data.zone_oid+"_cmd", '{ "command":"foo" }');
            
        } catch(ex) {
            console.error(ex);
        }
    },
    //--------------------------------------------------------------------
    _onApply: function(ctx) {
        vis.setValue(ctx.data.zone_oid+"_cmd", 
            `{ "command":"Override", "setpoint":${ctx.sel_sp} }`
            );
        ctx.dialog.dialog("close");
    },
    //--------------------------------------------------------------------
    _openModeDialog: function(ctx) {
        ctx.sel_sp = ctx.sp;
        ctx.temp_slider.slider("value", ctx.sp);
        ctx.dialog.dialog("open");
    }
    //--------------------------------------------------------------------
    /*
    onIdChange: function (widgetID, view, newId, attr, isCss, oldValue) {
        if (oldValue && oldValue !== 'nothing_selected') return;
        return vis.binds.hqwidgets.changedId (widgetID, view, newId, {
            'oid-battery':  'indicator.battery',
            'oid-working':  'indicator.working',
            'oid-signal':   'indicator.signal'
        });
    }
    */
    //--------------------------------------------------------------------
};

vis.binds["evohome_zone"].showVersion();


