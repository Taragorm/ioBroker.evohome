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
                "PermanentOverride":"Perm Ovr",
                "TemporaryOverride":"Temp Ovr"
                };

            var sel_sp;
            var mv;
            var sp;
            var mode;
            var faults;
            var available;
            var ovr_until;
            var vect = taragorm_common.getColourVector(data.colours);
            var fmt =  data.format || "%.1f &deg;C";
            var zone_oid = data.zone_oid;
            var interpolate = data.interpolate;

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
<tr><th> 
    ${title}
    <span class='vis_evohome_zone-err' >&#9888;</span>
</th></tr>
<tr><td><span class='vis_evohome_zone-mv'></span></td></tr>
<tr><td>
    <span class='vis_evohome_zone-sp'></span>
</td></tr>
<tr><td>
    <span class='vis_evohome_zone-mode'></span> 
    <span class='vis_evohome_zone-set' >&#9881;</span>            
</td></tr>
</table>
<div id='${widgetID}-dialog' title='Zone ${title} control'>
    <form>
    <fieldset>
        <legend>Status</legend>
        <div id='status'> </div>
    </fieldset>    
    <fieldset>
        <legend>Setpoint</legend>
        <div class="temp-slider">
        <div class="custom-handle ui-slider-handle"></div>
        </div> 
    </fieldset>    
    <fieldset>
        <legend>Override Until </legend>
        <input type="radio" name="duration" id="radio-ns" value="ns" checked>
        <label for="radio-ns">Next Switch</label>
        <input type="radio" name="duration" id="radio-r" value="r">
        <label for="radio-r">Duration</label>
        <input type="radio" name="duration" id="radio-p" value="p">
        <label for="radio-p">Forever</label>
    </fieldset>    
    <fieldset id='duration'>
        <legend>Duration </legend>
        <label for="hrs">Hours</label>
        <input id="hrs" name="value" size="3" value="1">
        <label for="mins">Mins</label>
        <input id="mins" name="value" size="3" value="0">                
    </fieldset>    
    <a id='${widgetID}-apply'>Apply</a>
    <a id='${widgetID}-cancel'>Cancel Ovr</a>
    </form>
</div>
<div id='${widgetID}-err-dialog' title='Zone ${title} Errors'>
<div>
`);
            var $table = $div.find('.vis_evohome_zone-table')
            var $mv = $div.find('.vis_evohome_zone-mv');
            var $sp = $div.find('.vis_evohome_zone-sp');

            var $mode = $div.find('.vis_evohome_zone-mode');

            $div.find(".vis_evohome_zone-set").click( _openModeDialog );

            var $err = $div.find('.vis_evohome_zone-err').click( _openErrorDialog );
            //$div.find("input:radio" ).checkboxradio();

            $('input[type=radio][name=duration]').change(_durationRadioChange);

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
                    autoOpen: false,
                    modal:true,
                    width:"auto"
                });

            var $err_dialog = findId("-err-dialog")
                .dialog({
                    autoOpen: false,
                    modal: true
                });

            $dialog.find('#duration').hide();
            $dialog.find('#hrs').spinner({min:0});
            $dialog.find('#mins').spinner({min:0, step:10});

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
            faults = v.faults;
            available = v.isAvailable;
            ovr_until = v.until;
                
            $mv.html( taragorm_common.format(fmt, mv) );
            $sp.html( taragorm_common.format(fmt, sp) );
                    
            var mvcols = taragorm_common.getColours(mv, vect, interpolate);
            var spbg = taragorm_common.getBackground(sp, vect, interpolate);
            $table.css({ "background": "radial-gradient("+ mvcols.b+", "+ spbg + ")", "foreground-color": mvcols.f } );                            
            $mode.html( shortmodes[mode] || mode  ); 

            if(available && faults.length==0)
                $err.hide();
            else
                $err.show();

            //console.log("faults=",v.faults, typeof v.faults);
            //$fault.html( v.faults ? v.faults.join() : "" ); 
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _durationRadioChange() {
            // use this.value
            var $dur = $dialog.find('#duration');
            if(this.value=="r") {
                // relative
                $dur.show();    
            } else {
                $dur.hide();    
            }
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _openErrorDialog () {
            $err_dialog.html(`
<b>Available: </b> ${available}<br>
<b>Faults: </b> ${faults ? faults.join() : ""}
`);
            $err_dialog.dialog("open");
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _openModeDialog () {
            sel_sp = sp;
            $temp_slider.slider("value", sp);
            let st = [];
            st.push(`<b>Mode:</b> ${mode}`);
            if(ovr_until)
                st.push(`<br><b>Until:</b> ${ovr_until}`);

            $dialog.find("#status").html(st.join(""));

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
            $mode.html(mode = "Pending"); 
            }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _onApply() {
            let rbs = $dialog.find('input[name=duration]:checked').val();

            var until;
            switch(rbs)
            {
                case "ns":
                    until = "next-switchpoint";
                    break;

                case "r":
                    var d1 = new Date ();
                    var until = new Date ( d1 );
                    var h = $dialog.find('#hrs').spinner("value");
                    var m = $dialog.find('#mins').spinner("value");
                    until.setHours ( d1.getHours() + h );                
                    until.setMinutes ( d1.getMinutes() + m );                
                    //console.log(`h=${h} m=${m} until=${until}`);
                    break;

                default:
                case "p":
                    break;
            }

            let data = {
                "command":"Override",
                "setpoint":sel_sp
            };

            if(until)
                data.until = until;

            //console.log(`On ${zone_oid} OverTemp=${sel_sp} Apply Until= ${until}`);

            vis.setValue( zone_oid+"_cmd", JSON.stringify(data));

            $dialog.dialog("close");
            $mode.html(mode = "Pending"); 
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function findId(id) { 
            return $div.find("#"+widgetID+id); 
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _onSlide ( event, ui ) {
            sel_sp = ui.value;
            var col = taragorm_common.getColours(sel_sp, vect, interpolate);
            $temp_slider.css("background", col.b);
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


