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
    
    
    //--------------------------------------------------------------------
    /**
    	Widget creation factory
     */
    createWidget: function (widgetID, view, data, style) {
        try {

            var shortmodes =  {
                "FollowSchedule":"Scheduled",
                "PermanentOverride":"Override"
                };

            var sel_sp;
            var mv;
            var sp;
            var mode;
            var vect = taragorm_common.getColourVector(data.colours);
            var fmt =  data.format || "%.1f &deg;C";
            var zone_oid = data.zone_oid;

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
            
    		var zone = zone_oid + ".val";
    
            $('#' + widgetID).html(`
<table width='100%' height='100%' class='vis_evohome_zone-table' style='background-color:#00ff00'>
<tr><th>${title}</th></tr>
<tr><td><span class='vis_evohome_zone-mv'></span></td></th>
<tr><td><span class='vis_evohome_zone-sp'></span></td></th>
<tr><td><a class='vis_evohome_zone-mode'></a></td></th>
<tr><td><span class='vis_evohome_zone-fault'></span></td></th>
</table>
<div id='${widgetID}-dialog' title='Zone ${title} control'>
    <form>
    <fieldset>
        <legend>Setpoint</legend>
        <div class="temp-slider">
        <div class="custom-handle ui-slider-handle"></div>
        </div> 
    </fieldset>    
    <fieldset>
        <legend>Duration </legend>
        <input type="radio" name="duration" id="radio-ns" checked>
        <label for="radio-ns">Next Switch</label>
        <input type="radio" name="duration" id="radio-p">
        <label for="radio-p">Forever</label>
    </fieldset>    
    <a id='${widgetID}-apply'>Apply</a>
    <a id='${widgetID}-cancel'>Cancel Ovr</a>
    </form>
</div>
`);
            var $table = $div.find('.vis_evohome_zone-table')
            var $mv = $div.find('.vis_evohome_zone-mv');
            var $sp = $div.find('.vis_evohome_zone-sp');
            var $mode = $div.find('.vis_evohome_zone-mode');
            var $fault = $div.find('.vis_evohome_zone-fault');
            //$div.find("input:radio" ).checkboxradio();

            var $slider_handle = $div.find(".custom-handle");
            var $temp_slider = $div.find(".temp-slider").slider({
                min: 10, max: 30, step: 0.5,
                create: function() {
                    $slider_handle.text( $( this ).slider( "value" ) );
                },
                change: _onSlide,
                slide: _onSlide
              });


              findId("-apply")
                .button()
                .click( _onApply )
                ;

              findId("-cancel")
                .button()
                .click( _onCancel )
                ;

            var $dialog = findId("-dialog")
                        .dialog({
                            autoOpen: false
                        });

            $div.find('.vis_evohome_zone-mode')
                        .button()
                        .click( _openModeDialog )
                        ;

            setValues(vis.states[ zone ]);
            
            // subscribe on updates of values
            let bound = [];
            let handlers = [];
            
            if(zone_oid) {
                bound.push( zone );
                handlers.push(this.setValues);
                vis.states.bind(zone, function (e, newVal, oldVal) {
                    setValues(newVal );
                });                
            }
    
            if(bound.length) {
                $div.data('bound', bound);
                $div.data('bindHandler', handlers);
            }

            
        } catch(ex) {
            console.error(ex);
        }

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Local functions
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        /**
            Update the HTML with live data.

            @param ctx      Context object
            @param vjson	Value state as JSON
        */
        function setValues(vjson) {
            
            //console.log("setvalues v=",vjson);
            
            const v = JSON.parse(vjson);
            mv = v.temperature;
            sp = v.setpoint;
            mode = v.setpointMode;

                
            $mv.html( taragorm_common.format(fmt, mv) );
            $sp.html( taragorm_common.format(fmt, sp) );
                    
            var mvcols = taragorm_common.getColours(mv, vect, data.interpolate);
            var spbg = taragorm_common.getBackground(sp, vect, data.interpolate);
            $table.css({ "background": "radial-gradient("+ mvcols.b+", "+ spbg + ")", "foreground-color": mvcols.f } );                            
            $mode.html( shortmodes[mode] || mode  ); 
            //console.log("faults=",v.faults, typeof v.faults);
            $fault.html( v.faults ? v.faults.join() : "" ); 
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _openModeDialog () {
            sel_sp = sp;
            $temp_slider.slider("value", sp);
            $dialog.dialog("open");
        }    
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _getChecked(id) {
            return $dialog.find(id).is(":checked");
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _onCancel() {
            let data = {
                "command":"CancelOverride",
                "setpoint":sel_sp
            };

            vis.setValue(
                zone_oid+"_cmd", 
                JSON.stringify(data)
                );

            $dialog.dialog("close");
            $mode.html("Pending"); 
            }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _onApply() {

            if( _getChecked("#radio-ns") ) {
                var until = "next-switchpoint"; // special value driver will interpret
            }

            let data = {
                "command":"Override",
                "setpoint":sel_sp
            };

            if(until)
                data.until = until;

            console.log(`On ${zone_oid} OverTemp=${sel_sp} Apply Until= ${until}`);

            vis.setValue(
                zone_oid+"_cmd", 
                JSON.stringify(data)
                );

            $dialog.dialog("close");
            $mode.html("Pending"); 
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function findId(id) { 
            return $div.find("#"+widgetID+id); 
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _onSlide ( event, ui ) {
            sel_sp = ui.value;
            $slider_handle.text( ui.value );        
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    },
    //--------------------------------------------------------------------
    //--------------------------------------------------------------------
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


