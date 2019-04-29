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
    version: "0.0.2",
    
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
            var zone_oid = data.zone_oid;
            var interpolate = data.interpolate;
            var title_fmt =  data.titleFormat || "<span style='font-weight: bold;'>%s</span>";
            var title =  data.titleText ? data.titleText.trim() : undefined;
            var sp_fmt =  data.spFormat || "<span style='font-size: 80%%;'>%.1f &deg;C</span>";
            var mv_fmt =  data.mvFormat || "<span style='font-weight: bold;'>%.1f &deg;C</span>";
            var mode_fmt =  data.modeFormat || "<span style='font-size: 80%%;'>%s</span>";
            let footer = data.footer ? `<tr><td>${data.footer}` : "";
            var edit_sch_day;
            var $edit_swpt;


            var $div = $('#' + widgetID);
            // if nothing found => wait
            if (!$div.length) {
                return setTimeout(function () {
                    vis.binds["evohome_zone"].createWidget(widgetID, view, data, style);
                }, 100);
            }
            

            //console.log("Create mvsp");
            if(!title) {
                let frags = zone_oid.split(".");
                title = frags[frags.length-2];
            }
        
            let title_html = sprintf(title_fmt, title);


    		var zone = zone_oid + ".val";
            
            $('#' + widgetID).html(`
<table width='100%' height='100%' class='vis_evohome-table' style='background-color:#00ff00'>
<tr><th> 
    ${title_html}
    <!-- <span class='vis_evohome-err' >&#9888;</span> -->
    <span class='vis_evohome-err fas fa-exclamation-triangle' ></span> 

</th></tr>
<tr><td><span class='vis_evohome-mv'></span></td></tr>
<tr><td>
    <span class='vis_evohome-sp'></span>
</td></tr>
<tr><td>    
    <span class='vis_evohome-set'> 
                <span class='vis_evohome-mode'></span> 
                <span class='fas fa-cog' ></span>  
                <span class="vis_evohome-timed fas fa-clock"></span>
    </span>
</td></tr>
    ${footer}
</table>

<div id='${widgetID}-err-dialog' title='Zone ${title} Errors'> </div>

<div id='query-dialog' title='Query'> </div>

<div id='${widgetID}-dialog' title='Zone ${title} control'>
    <div id="tabs">
        <ul>
            <li><a href="#settings">Settings</a>
            <li><a href="#schedule">Schedule</a>
        </ul>

    <div id="settings"><form>
        <fieldset>
            <legend>Status</legend>
            <div id='status'> </div>
        </fieldset>    
        <fieldset>
            <legend>Setpoint</legend>
            <div id="sp-slider" class="temp-slider"> <div id="sp-slider-handle" class="ui-slider-handle custom-handle "> </div> </div> 
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
            <label for="days">Days</label>
            <input id="days" name="value" size="3" value="0">
            <label for="hrs">Hours</label>
            <input id="hrs" name="value" size="3" value="1">
            <label for="mins">Mins</label>
            <input id="mins" name="value" size="3" value="0">                
        </fieldset>    
        <br>
        <a id='${widgetID}-apply'>Apply</a>
        <a id='${widgetID}-cancel'>Cancel Ovr</a>
    </form></div>

    <div id="schedule"><form>
        <fieldset>
            <select id="daysel">
            <option id="day0" value='0'></option>
            <option id="day1" value='1'></option>
            <option id="day2" value='2'></option>
            <option id="day3" value='3'></option>
            <option id="day4" value='4'></option>
            <option id="day5" value='5'></option>
            <option id="day6" value='6'></option>
            </select>
        </fieldset>

        <fieldset id='sch-detail'> 
        </fieldset>

        <div id="sch-edit">
            <fieldset>
                <legend>Setpoint</legend>
                <div id="sch-slider" class="temp-slider"> <div id="sch-slider-handle" class="ui-slider-handle custom-handle"> </div> </div> 
            </fieldset>

            <fieldset id='Switchtime'>
            <legend>Switchtime</legend>
            <input id="sw-hrs" name="value" size="3" value="1">
            <b>:</>
            <input id="sw-mins" name="value" size="3" value="0">                
            </fieldset>    
        </div>
        <a id='applysch'>Save</a>
        <a id='addsch'>+</a>
        <a id="delsch">&#x1f5d1;</a>

    </form></div>
</div>


`);
            
            var $table = $div.find('.vis_evohome-table')
            var $timed = $div.find('.vis_evohome-timed')
            var $mv = $div.find('.vis_evohome-mv');
            var $sp = $div.find('.vis_evohome-sp');

            var $mode = $div.find('.vis_evohome-mode');

            $div.find(".vis_evohome-set").click( _openModeDialog );

            var $err = $div.find('.vis_evohome-err').click( _openErrorDialog );
            //$div.find("input:radio" ).checkboxradio();

            $('input[type=radio][name=duration]').change(_durationRadioChange);
            var $sp_slider_handle = $div.find("#sp-slider-handle");
            var $sp_slider = $div.find("#sp-slider").slider({
                min: 10, max: 30, step: 0.5,
                create: function() {
                    $sp_slider_handle.text( fmtTemp($( this ).slider( "value" )) );
                },
                change: _onSlide,
                slide: _onSlide
              });

              var $sch_slider_handle = $div.find("#sch-slider-handle");
              var $sch_slider = $div.find("#sch-slider").slider({
                min: 10, max: 30, step: 0.5,
                create: function() {
                    $sch_slider_handle.text( fmtTemp($( this ).slider( "value" )) );
                },
                change: _onSchSlide,
                slide: _onSchSlide
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

            var $qdialog = $div.find("#query-dialog")
                .dialog({
                    autoOpen: false,
                    modal:true,
                    stack:true,
                    width:"auto"
                    });

            $dialog.find('#duration').hide();
            $dialog.find('#days').spinner({min:0});
            $dialog.find('#hrs').spinner({min:0});
            $dialog.find('#mins').spinner({min:0, step:10});
            $dialog.find("#tabs").tabs({
                beforeActivate: _onTabSelect
            });
            $dialog.find("#daysel").change(_swptDayChange);
            $dialog.find('#sw-hrs').spinner({
                        min:0, max:23,
                        change: _chSwitchTime,
                        stop: _chSwitchTime
                        });

            $dialog.find('#sw-mins').spinner({
                        min:0, max:59, step:10,
                        change: _chSwitchTime,
                        stop: _chSwitchTime
                        });

            $dialog.find("#applysch").button().click(_schApply);
            $dialog.find("#addsch").button().click(_schAdd);
            $dialog.find("#delsch").button().click(_schDel);


            setValues(vis.states[ zone ]);
            
            // subscribe on updates of values
            let bound = [];
            let handlers = [];
            
            if(zone_oid) {
                bound.push( zone );
                handlers.push(setValues);
                vis.states.bind(zone, function (e, newVal, oldVal) {
                    setValues(newVal );
                });                
            }
    
            if(bound.length) {
                $div.data('bound', bound);
                $div.data('bindHandler', handlers);
            }

            //this.
            
        } catch(ex) {
            console.error(ex);
        }

        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        // Local functions
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function fmtTemp(t) {
            return sprintf("%4.1f",t || 0);
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        /**
            Update the HTML with live data.

            @param ctx      Context object
            @param vjson	Value state as JSON
        */
        function setValues(vjson) {
            
            //console.log("setvalues v=",vjson);         
            try {   
                var v = JSON.parse(vjson);
            } catch(ex) {
                v = { "error":"BadData"};
            }

            if(v.error) {
                $mode.html( v.error ); 
                $table.css("background","magenta");
                return;
            }

            mv = v.temperature;
            sp = v.setpoint;
            mode = v.setpointMode;
            faults = v.faults;
            available = v.isAvailable;
            ovr_until = v.until;
                
            $mv.html( taragorm_common.format(mv_fmt, mv) );
            $sp.html( taragorm_common.format(sp_fmt, sp) );
                    
            var mvcols = taragorm_common.getColours(mv, vect, interpolate);
            var spbg = taragorm_common.getBackground(sp, vect, interpolate);
            $table.css({ "background": "radial-gradient("+ mvcols.b+", "+ spbg + ")", "foreground-color": mvcols.f } );                            
            $mode.html( sprintf(mode_fmt, shortmodes[mode] || mode) ); 

            if(available && faults.length==0) $err.hide(); else $err.show();
            if(ovr_until) $timed.show(); else $timed.hide();

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
            $sp_slider.slider("value", sp);
            let st = [];
            st.push(`<b>Mode:</b> ${mode}`);
            if(ovr_until)
                st.push(`<br><b>Until:</b> ${ovr_until}`);

            $dialog.find("#status").html(st.join(""));

            $dialog.dialog("open");
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
                    var d = $dialog.find('#days').spinner("value");
                    var h = $dialog.find('#hrs').spinner("value");
                    var m = $dialog.find('#mins').spinner("value");
                    until.setDays ( d1.getDays() + d );                
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
            $sp_slider.css("background", col.b);
            $sp_slider_handle.text( fmtTemp(ui.value) );        
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _onTabSelect(event,ui) {
            //console.log(ui.newPanel.attr('id'));
            switch(ui.newPanel.attr('id')) {
                case "schedule":
                    if(!ui.newPanel.data("schedule")) {
                        _getSchedule();
                    }
                    break;

                default:
                    return;
            }
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        /**
         * Return OID for zone
         */
        function zoneRoot() {
            return zone_oid.substring(0, zone_oid.lastIndexOf('.'));
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//        function _loadSchedule() {


//            let url = `../get/${zoneRoot()}.schedule`;
            //console.log(url)
//            $.ajax({
//                    url: url, 
//                    success: _gotSchedule
//              });            
//        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _getSchedule() {
            //console.log(result);
            let st = JSON.parse(vis.states[ zone ]);
            let sch = st.schedule;
            let $sel = $dialog.find("#daysel").data("schedule", sch);
            
            for (let di=0; di<sch.dailySchedules.length; ++di ) {
                const day = sch.dailySchedules[di];
                let $opt=$sel.find("#day"+di).data("schedule", day);
                $opt.html(day.dayOfWeek);
            }
            _loadDetailForDay(0);
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _loadDetailForDay(dno) {
            //console.log(dno);
            edit_sch_day =$dialog.find("#day"+dno).data("schedule");
            
            _loadDetailForCurrentDay();

             let $radio = $dialog.find("#swp_0");
             $radio.prop("checked",true);
             _swptSelChange(null,null,$radio);
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _loadDetailForCurrentDay(selswpt) {
            let lst = [];
            let ix=0;
            for (const swp of edit_sch_day.switchpoints) {
                let checked = (selswpt===swp);
                let clrs = taragorm_common.getColours( Number(swp.heatSetpoint), vect, interpolate);
                lst.push(
`<input type='radio' name='rad-swpt' value='${swp.timeOfDay}' id='${"swp_"+ix}' ${checked ? "checked" : ""} > 
<label id='${"lswp_"+ix}' for='${"swp_"+ix}' style='width:100%;color:${clrs.f};background:${clrs.b}'>${swp.timeOfDay} ${fmtTemp(swp.heatSetpoint)}&deg;C</label><br>`
                    );
                ++ix;
            }
            $dialog.find("#sch-detail").html(lst.join("\n"));
            $dialog.find('input[type=radio][name=rad-swpt]').change(_swptSelChange);
            ix=0;

            // bind objects to HTML
            $edit_swpt = undefined;

            for (const swp of edit_sch_day.switchpoints) {
                let $radio = $dialog.find('#swp_'+ix);
                $radio.data("swp",swp);
                if(selswpt===swp)
                    $edit_swpt = $radio;
                ++ix;
            }

            $dialog.find("#addsch").prop("disabled", edit_sch_day.switchpoints.length >= 6);

            let none = edit_sch_day.switchpoints.length === 0;
            $dialog.find("#delsch").prop("disabled", none);
            $dialog.find("#sch-edit").prop("disabled", none);
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _swptDayChange(event,ui) {
            console.log("DayChange")
            _loadDetailForDay(this.value);
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        /**
         * Change handler for switchpoint selection.
         * @param {*} event 
         * @param {*} ui 
         */
        function _swptSelChange(event,ui, $radio) {
            // use this.value
            if(!$radio) 
                $radio = $(this);

            $edit_swpt = $radio;
            var swp = $radio.data("swp");
            //var $dur = $dialog.find('#duration');
            $sch_slider.slider("value",swp.heatSetpoint);
            let frags = swp.timeOfDay.split(':');
            $dialog.find("#sw-hrs").spinner("value", Number(frags[0]) );
            $dialog.find("#sw-mins").spinner("value", Number(frags[1]) );            
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _onSchSlide ( event, ui ) {
            _updateSwitchpoint(ui.value,null);
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _chSwitchTime ( event, ui ) {
            _updateSwitchpoint(
                null,
                sprintf(
                    "%02d:%02d:00",
                    $dialog.find('#sw-hrs').spinner("value"),
                    $dialog.find('#sw-mins').spinner("value")
                    )
            );
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        /**
         * Call this when one or both of the switchpoint values have been
         * changed.
         * 
         * @param {Number} sp 
         * @param {String} when 
         */
        function _updateSwitchpoint(sp,when)
        {
            //console.log(`Update ${sp} ${when}`);

            var swp = $edit_swpt.data("swp");
            if(sp==null) {
                sp = swp.heatSetpoint;
            } else {
                var spchange = (sp != swp.heatSetpoint_);
                swp.heatSetpoint = sp;
            }

            if(when==null) {
                when = swp.timeOfDay;
            } else {
                var tchange = (when !== swp.timeOfDay );
                swp.timeOfDay = when;
            }

            let lblid = "#l" + $edit_swpt.attr("id");
            let fsp = fmtTemp(sp);
            let txt = `${when} ${fsp}&deg;C`;
            //console.log(lblid);            
            let $lbl = $dialog.find(lblid).html(txt);

            if(spchange) {
                let col = taragorm_common.getColours(sp, vect, interpolate);
                $lbl.css("background", col.b);
                $sch_slider.css("background", col.b);
                $sch_slider_handle.text( fsp );        
            }

            if(tchange) {
                // might have to re-order
                let swps = edit_sch_day.switchpoints;
                let ix = swps.indexOf(swp);
                if( (ix>0 && swps[ix-1].timeOfDay > when) 
                    || (ix<(swps.length-1) && swps[ix+1].timeOfDay < when)
                    ) {
                    // force re-order
                    swps.sort( (a,b) => a.timeOfDay.localeCompare(b.timeOfDay));
                    _loadDetailForCurrentDay(swp);
                }
            }
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _schApply() {

            let sch = $dialog.find("#daysel").data("schedule");
            

            $qdialog.dialog({
                buttons: {
                    "OK": _ok,
                    "Cancel": () => { $qdialog.dialog("close"); }
                }
                });
        
            let lst = [];
            lst.push("<b>Save To?</b><br>")
            for (let di=0; di<sch.dailySchedules.length; ++di ) {
                const day = sch.dailySchedules[di];
                const dow = day.dayOfWeek;
                //let $opt=$sel.find("#day"+di).data("schedule", day);
                //$opt.html(day.dayOfWeek);
                lst.push(`
<input type="checkbox" id="${dow}" value="${dow}" ${edit_sch_day===day ? "checked disabled" : "" }>
<label for="${dow}">${dow}</label><br>`
                );

            }

            $qdialog.html(lst.join("")).dialog("open");

            function _ok() {
                // clone this days switchpoints
                $qdialog.find('input:checked').each( (i,ob) => {
                    let wdow = $(ob).val();
                    let wday = sch.dailySchedules.find( (e) => e.dayOfWeek == wdow);
                    if(wday !== edit_sch_day) {
                        wday.switchpoints =  JSON.parse(JSON.stringify(edit_sch_day.switchpoints));
                    }
                });

                // finally, send command to zone
                let data = {
                    "command":"SetSchedule",
                    "schedule": sch
                };
        
                vis.setValue( zone_oid+"_cmd", JSON.stringify(data));
    
                $qdialog.dialog("close");
                $dialog.dialog("close");
            }
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _schAdd() {
            var nsw = {
                "timeOfDay": "00:00:00",
                "heatSetpoint": 21
            };

            edit_sch_day.switchpoints.unshift(nsw);
            _loadDetailForCurrentDay(nsw);
            let $radio = $dialog.find("#swp_0");
            $radio.prop("checked",true);
            _swptSelChange(null,null,$radio);
       }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _schDel() {
            //console.log("del", $qdialog, $dialog);
            let $radio = $dialog.find('input[type=radio][name=rad-swpt]');
            if(!$radio.length)
                return;

           $qdialog.dialog({
                    buttons: {
                        "OK": _ok,
                        "Cancel": () => { $qdialog.dialog("close"); }
                    }
                    });

            $qdialog.html("Really Delete?").dialog("open");

            function _ok() {
                let swp = $radio.data("swp");
                let ix = edit_sch_day.switchpoints.indexOf(swp);
                edit_sch_day.switchpoints.splice(ix,1);
                if(ix >= edit_sch_day.switchpoints.length)
                    ix = edit_sch_day.switchpoints.length -1;
    
                _loadDetailForCurrentDay(edit_sch_day.switchpoints[ix]);
                if(ix >=0) {
                    // we still have an entry
                    let $radio = $dialog.find(`#swp_${ix}`);
                    $radio.prop("checked",true);
                    _swptSelChange(null,null,$radio);    
                }     

                $qdialog.dialog("close");
            }
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    } // endCreateWidget()
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
},
//===================================================================================
/**
 * Widget to provide a view of overall status, and a place to make 
 * global commands.
 */
vis.binds["evohome_system"] = {
    version: "0.0.1",
    
    showVersion: function () {
        if (vis.binds["evohome_system"].version) {
            console.log('Version evohome_system: ' + vis.binds["evohome_system"].version);
            vis.binds["evohome_system"].version = null;
        }
    },
    
    //--------------------------------------------------------------------
    
    
    //--------------------------------------------------------------------
    /**
    	Widget creation factory
     */
    createWidget: function (widgetID, view, data, style) {
        try {
            var sys_oid = data.sys_oid;            
            var $div = $('#' + widgetID);
            var status = {};

            // if nothing found => wait
            if (!$div.length) {
                return setTimeout(function () {
                    vis.binds["evohome_system"].createWidget(widgetID, view, data, style);
                }, 100);
            }
            

            //console.log("Create mvsp");
    		var title = data.titleText ? data.titleText.trim() : undefined;
    		if(!title) {
    			let frags = sys_oid.split(".");
    			title = frags[frags.length-2];
    		}

            $('#' + widgetID).html(`
            <table width='100%' height='100%' class='vis_evohome-table' style='background-color:#00ff00'>
            <tr><th> 
                ${title}
                <span class='vis_evohome-err fas fa-exclamation-triangle' ></span>
            </th></tr>
            <tr><td>
                <span class='vis_evohome-set' > 
                    <span class='vis_evohome-mode'></span> 
                    <span class="fas fa-cog"></span>
                    <span class="vis_evohome-timed fas fa-clock"></span>
                </span>            
            </td></tr>
            </table>

            <div id='${widgetID}-dialog' title='System ${title} control'>

                    <form id="settings">
                    <fieldset>
                        <legend>Status</legend>
                        <div id='status'> </div>
                    </fieldset>    
                    <fieldset>
                        <legend>Override Until </legend>
                        <input type="radio" name="duration" id="radio-r" value="r" checked>
                        <label for="radio-r">Duration</label>
                        <input type="radio" name="duration" id="radio-p" value="p">
                        <label for="radio-p">Forever</label>
                    </fieldset>    
                    <fieldset id='duration'>
                        <legend>Duration </legend>
                        <label for="days">Days</label>
                        <input id="days" name="value" size="3" value="0">
                        <label for="hrs">Hours</label>
                        <input id="hrs" name="value" size="3" value="1">
                        <label for="mins">Mins</label>
                        <input id="mins" name="value" size="3" value="0">                
                    </fieldset>    
                    <a class="tara-cmd" name="Auto">Auto</a>
                    <a class="tara-cmd" name="AutoWithReset">Auto+Reset</a>
                    <a class="tara-cmd" name="Custom">Custom</a>
                    <a class="tara-cmd" name="AutoWithEco">Auto+Eco</a>
                    <a class="tara-cmd" name="Away">Away</a>
                    <a class="tara-cmd" name="DayOff">Day Off</a>
                    <a class="tara-cmd" name="HeatingOff">Heating Off</a>
                    <!-- <a id='${widgetID}-cancel'>Cancel Ovr</a> -->
                    </form>
                </div>

                <form id="schedule">
                </form>

            <div id='${widgetID}-err-dialog' title='Zone ${title} Errors'>

            <div>
            `);
            
            var $table = $div.find('.vis_evohome-table');
            var $timed = $div.find('.vis_evohome-timed')
            var $mode = $div.find('.vis_evohome-mode');

            $div.find(".vis_evohome-set").click( _openModeDialog );

            var $err = $div.find('.vis_evohome-err').click( _openErrorDialog );

            //$div.find("input:radio" ).checkboxradio();

            $('input[type=radio][name=duration]').change(_durationRadioChange);


            $div.find(".tara-cmd")
                .button()
                .click( _onApply )
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
                    modal: true,
                    width:"auto"
                });

            //$dialog.find('#duration').hide();
            $dialog.find('#days').spinner({min:0});
            $dialog.find('#hrs').spinner({min:0});
            $dialog.find('#mins').spinner({min:0, step:10});

            _setValue(vis.states[ sys_oid +".val"]);
            
            // subscribe on updates of values
            let bound = [];
            let handlers = [];
            
            if(sys_oid) {
                bound.push( sys_oid +".val" );
                handlers.push(_setValue);
                vis.states.bind(sys_oid +".val", function (e, newVal, oldVal) {
                    _setValue(newVal );
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
         * Update state view according to JSON blob from the state signal.
         * 
         * @param {string} st Status JSON blob for whole system
         */
        function _setValue(stjson)
        {
            //console.log(stjson);

            try {
                status = JSON.parse(stjson);
            }
            catch(ex) {
                status = {"error":"Bad Data"};
            }

            if(status.error) {
                $mode.html( status.error ); 
                $table.css("background","magenta");
                $err.show();
                return;
            }
            
            $mode.html(status.mode);
            let color = "gray";
            let showerr = false;
            if( status.sysfaults.length>0
                || status.zn_unavail.length>0
                || status.zn_fault.length > 0 
                ) {
                color = "red";
                showerr = true;
            } else if(status.zn_notsched.length > 0) {
                color ="yellow";
                showerr = true;
            } else if(status.mode === "AutoWithEco" || status.mode === "Away" ) {
                color = "darkgreen";
            } else if(status.mode === "HeatingOff") {
                color = "dodgerblue";
            } else if(status.mode === "DayOff" || status.mode === "Custom") {
                color = "mediumpurple";
            } else {
                color = "lightgray";
            // Auto, Auto with reset 
            }

            $table.css("background",color);

            if(showerr) $err.show(); else $err.hide();
            if(status.until) $timed.show(); else $timed.hide();
            
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _durationRadioChange() {
            // use this.value
            var $dur = $dialog.find('#duration');

            switch(this.value) {
                case "r":
                    $dur.show();    
                    break;

                default:
                    $dur.hide();    
                    break;
            }
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _openErrorDialog () {

            let sysf = status && status.sysfaults && status.sysfaults.join() || ""; 
            let zunav = status && status.zn_unavail && status.zn_unavail.join() || "";
            let zf = status && status.zn_fault && status.zn_fault.join() || "";
            let zover = status && status.zn_notsched && status.zn_notsched.join() || "";

            $err_dialog.html(`
<table>            
<tr><th>Comms <td> ${status.error || "OK"}
<tr><th>Sys Mode: <td> ${status.mode} ${status.until ? " until "+status.until : ""}
<tr><th>Sys Faults: <td> ${sysf} 
<tr><th>Unavailable Zones: <td> ${zunav}
<tr><th>Faulty Zones: <td> ${zf}
<tr><th>Overidden Zones: <td> ${zover}
</table>
`);
            $err_dialog.dialog("open");
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _openModeDialog () {
            let st = [];
            st.push(`<b>Mode:</b> ${status.mode}`);
            if(status.until)
                st.push(`<br><b>Until:</b> ${status.until}`);

            $dialog.find("#status").html(st.join(""));

            $dialog.dialog("open");
        }    
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function findId(id) { 
            return $div.find("#"+widgetID+id); 
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
        function _onApply() {
            //console.log(this.name);

            let rbs = $dialog.find('input[name=duration]:checked').val();

            var until;
            switch(rbs)
            {
                case "r":
                    var d1 = new Date ();
                    var until = new Date ( d1 );
                    var d = $dialog.find('#days').spinner("value");
                    var h = $dialog.find('#hrs').spinner("value");
                    var m = $dialog.find('#mins').spinner("value");
                    until.setDays ( d1.getDays() + d );                
                    until.setHours ( d1.getHours() + h );                
                    until.setMinutes ( d1.getMinutes() + m );                
                    //console.log(`h=${h} m=${m} until=${until}`);
                    break;

                default:
                case "p":
                    break;
            }

            let data = {
                "command":"setmode",
                "mode":this.name
            };

            if(until)
                data.until = until;

            //console.log(`On ${zone_oid} OverTemp=${sel_sp} Apply Until= ${until}`);
            let cmd_oid = sys_oid.substring(0, sys_oid.lastIndexOf(".")) + ".cmd"
            vis.setValue( cmd_oid, JSON.stringify(data));

            $dialog.dialog("close");
            $mode.html(status.mode = "Pending"); 
            
        }
        //~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    }
}



vis.binds["evohome_zone"].showVersion();
vis.binds["evohome_system"].showVersion();


