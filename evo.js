/** @file
 * @brief Evohome support module
 * 
 * Inspiration/examples taken from evohomeclient2
 * 
 * At present support is limited to: 
 * - reading the hardware configuration
 * - reading the status
 * - writing the system state
 * - Only heating zones supported [I don't have anything else to test vs]
 * - No Hot Water [ditto]
 * 
 * Future:
 *  - Writing setpoints
 *  - Reading schedules
 *  - Writing schedules
 *  
 */
req = require('request-promise-native');
assert = require("assert");
sprintf = require("sprintf-js");

HONEYWELL = 'https://tccna.honeywell.com/';
APPID = '91db1612-73fd-4500-91b2-e63b069b185c';
HOST = "rs.alarmnet.com";

class BadStructure extends Error {};

class Evo {
    
    //--------------------------------------------------------
    /**
     * Make Evohome connector
     * @param {string} user   Username
     * @param {string} pass   User password
     * @param {string} appId  Application ID (optional) - Not sure what this is for
     * @returns {nm$_evo.Evo}
     */
    constructor(user, pass, appId ) {
        this.username = user;
        this.password = pass;    
        this.appId = appId || APPID;
        this.installation = undefined;
        this.userAccount = undefined;
        this.access_token = undefined;
        this.access_token_expires = undefined;
        this.system = undefined;
        this.label = "EVO";
        this.log = console;
    }
    //--------------------------------------------------------
    /**
     * Create a pristine daily schedule
     */
    static createDailySchedule() {
        return new DailySchedule();
    }
    //--------------------------------------------------------
    /**
     * Convert a date/time to iso string format
     * @param {*} d 
     */
    static toDateTimeString(d) {
        
        if(!d || typeof d == "string")
            return d;

        return d.toISOString();
    }
    //--------------------------------------------------------
    /**
     * Get an access token, and build our common headers
     * @returns {nm$_evo.exports.basicLogin.resp|nm$_evo.Evo.basicLogin.resp}
     */
    async _basicLogin() {
        
        var options = {
            method: 'POST',
            uri: 'https://tccna.honeywell.com/Auth/OAuth/Token',
            headers: {
                'User-Agent': 'Request-Promise',
                'Authorization': 'Basic NGEyMzEwODktZDJiNi00MWJkLWE1ZWItMTZhMGE0MjJiOTk5OjFhMTVjZGI4LTQyZGUtNDA3Yi1hZGQwLTA1OWY5MmM1MzBjYg==',
                'Accept': 'application/json, application/xml, text/json, text/x-json, text/javascript, text/xml'
            },
            form: {
                'Content-Type':	'application/x-www-form-urlencoded; charset=utf-8',
                'Host':	HOST,
                'Cache-Control':'no-store no-cache',
                'Pragma':	'no-cache',
                'grant_type':	'password',
                'scope':	'EMEA-V1-Basic EMEA-V1-Anonymous EMEA-V1-Get-Current-User-Account',
                'Username':	this.username,
                'Password':	this.password,
                'Connection':	'Keep-Alive'            
            },
            json: true // Automatically parses the JSON string in the response
        };      
        
        let resp = await req(options);
        this.access_token = resp.access_token;
        var d = new Date();
        d.setSeconds(d.getSeconds() + resp.expires_in -30 ); // offset a smidge
        this.access_token_expires = d;
        this._headers = {
            'Authorization': 'bearer ' + this.access_token,
            'Accept': 'application/json, application/xml, text/json, text/x-json, text/javascript, text/xml'            
        };
        return resp;
    }
    //--------------------------------------------------------
    /**
     * Get user account data
     * @returns {unresolved}
     */
    async getUserAccount()
    {
        this.userAccount = await req({
            method:'GET',
            uri: HONEYWELL + "WebApi/emea/api/v1/userAccount",
            headers: await this.headers(),
            json: true
        });
        //console.log(JSON.stringify(this.userAccount));
        return this.userAccount;
    }
    //--------------------------------------------------------
    /**
     * get headers, recreating the access token as required.
     * @returns {nm$_evo.Evo._headers}
     */
    async headers(json) {
        if(
                !this.access_token
                || !this.access_token_expires
                || new Date() > this.access_token_expires
        ) await this._basicLogin()

        if(json) {
            let h = Object.assign({}, this._headers);
            h['Content-Type'] = 'application/json';
            return h;
        }

        return this._headers;
    }    
    //--------------------------------------------------------
    async getInstallation()
    {
        let uri = HONEYWELL + `WebApi/emea/api/v1/location/installationInfo?userId=${this.userAccount.userId}&includeTemperatureControlSystems=True`;
        //console.log(uri);
        this.installation = await req({
            method:'GET',
            uri: uri,
            headers: await this.headers(),
            json: true
        });
        
        //
        // Fixup the installation objects 
     
        for(let i=0; i<this.installation.length; ++i) {
            console.log(`Loc ${i}`);
            let loc = new Location(this, this.installation[i]);
            this.installation[i] = loc;
            for(let j=0; j<loc.gateways.length; ++j) {
                console.log(`  Gate ${j}`);
                let gate = new Gateway(loc, loc.gateways[j]);
                loc.gateways[j] = gate;
                for(let k=0; k<gate.temperatureControlSystems.length; ++k) {
                    console.log(`    System ${k}`);
                    let sys = new TemperatureControlSystem(gate, gate.temperatureControlSystems[k]);
                    gate.temperatureControlSystems[k] = sys;
                    for(let l=0; l<sys.zones.length; ++l) {
                        let zn = sys.makeZoneObject(l);
                        sys.zones[l] = zn;
                        console.log(`        zn ${l} ${zn.name}`);
                    }
                    
                    if(this.system===undefined) {
                        this.system = sys;
                    } else {
                        this.system = null; // second instance causes single instance to be reset
                    }
                }
            }
        }
        this.structureError = "";
        return this.installation;
    }
    //--------------------------------------------------------
    async login() {
        await this._basicLogin();
        await this.getUserAccount();
        await this.getInstallation();
        return this.installation;
    }
    //--------------------------------------------------------
    async getStatus() {
        
        var status;
        for(let loc of this.installation) {
            status = await loc.getStatus();
        }
        return status;
    }
    //--------------------------------------------------------
    userId()
    {
        return this.userAccount.userId;
    }
    //--------------------------------------------------------
    setStructureError(err) {
        if(!this.structureError)
            this.structureError = err;
    }
    //--------------------------------------------------------
    *locations() {
     for(let loc of this.installation)
         yield loc;
    }
    //--------------------------------------------------------
};
//============================================================
/**
 * Wrap location object with some methods
 */
class Location  {    
    constructor(evo, pjso) {
        Object.assign(this, pjso);
        // $ prefix allows us to filter refs out
        this.$evo = evo;
        this.label = "LOCATION";        
        assert(pjso.gateways !== undefined );
        assert(this.gateways !== undefined );
        assert(this.getStatus !== undefined );
        assert(this.$evo !== undefined && this.$evo.label == "EVO");
    }
    
    //---------------------------------------------------------
    /**
     * Fetches the status of the devices at the location, and merges the data
     * with the installation data.
     * 
     * It may also set evo.structure_error if we encounter hardware in the
     * status that isn't known. We should re-init if this happens.
     * 
     * @returns {unresolved}
     */
    async getStatus() {
        let uri = HONEYWELL + `WebApi/emea/api/v1/location/${this.locationInfo.locationId}/status?includeTemperatureControlSystems=True`;
        console.log(`Status Fetch from ${uri}`);
        this.$status = await req({
            method:'GET',
            uri: uri,
            headers: await this.$evo.headers(),
            json: true
        });
        
        //
        // merge the status into installation data
        for(let gws of this.$status.gateways) {
            let gw = this.gatewayById(gws.gatewayId, false);
            if(!gw) {
                this.$evo.setStructureError(`Unknown gateway in status ${gws.gatewayId}`);
                continue;
            }
                
            gw.$status = gws;
            
            for(let css of gws.temperatureControlSystems) {
                let cs = gw.controlSystemById(css.systemId, false);
                if(!cs) {
                    this.$evo.setStructureError(`Unknown Control System in status ${css.systemId}`);
                    continue;
                }
                cs.$status = css;
                
                for(let zs of css.zones) {
                    let z = cs.zoneById(zs.zoneId, false);
                    if(!z) {
                        this.$evo.setStructureError(`Unknown Zone in status ${zs.zoneId}`);
                        continue;
                    }
                    z.status = zs; // note no $ prefix

                    await z.getSchedule();
                }
            }
        }
            
        return this.$status;
    }
    //---------------------------------------------------------
    /**
     * Find a gateway by id
     * @param {string} gid 
     * @param {boolean} mandatory Set true to throw BadStructure if absent,
     *                  otherwise return undefined.
     * @returns gateway or undefined
     */
    gatewayById(gid, mandatory=false) {
        for(let gw of this.gateways)
            if(gw.id() === gid)
                return gw;
        
        if(mandatory)
            throw new BadStructure(`No gateway [${gid}]`);
    }
    //---------------------------------------------------------
    *_gateways()
    {
        for(let gw of this.gateways)
            yield gw;
    }
    //---------------------------------------------------------
    name() { return this.locationInfo.name; }
    //---------------------------------------------------------
    /**
     * Do an operation set by a JSON-formatted string.
     * In this case, they are applied to all controllers.
     * @param {json} cmd 
     */
    async doSystemCommand(cmd) {
        if( typeof cmd == "string")            
            cmd = JSON.parse(cmd);

        for(let gw of this.gateways)
            for(let cs of gw.zones)
                await cs.doSystemCommand(cmdjson);
    }
    //---------------------------------------------------------

};
//============================================================
/**
 * Extend gateway with some methods
 */
class Gateway {
    constructor(loc, pjso) {
        Object.assign(this, pjso);
        // $ prefix allows us to filter refs out
        this.$location = loc;
        this.$evo = loc.$evo;
        assert(this.$evo !== undefined && this.$evo.label == "EVO");
    }
    
    //---------------------------------------------------------
    id() {
        return this.gatewayInfo.gatewayId;
    }
    
    //---------------------------------------------------------
    controlSystemById(csid, mandatory=false){
        for(let cs of this.temperatureControlSystems)
            if(cs.id()===csid)
                return cs;
        
        if(mandatory)
            throw new BadStructure(`No controlsystem [${csid}]`);
    }
    //---------------------------------------------------------
    *systems() {
        for(let cs of this.temperatureControlSystems) 
            yield cs;
    }
    //---------------------------------------------------------
};
//============================================================
/**
 * Extend Temperature control system with some methods
 */
class TemperatureControlSystem {
    constructor(gateway, pjso)  {
        Object.assign(this, pjso);
        // $ prefix allows us to filter refs out
        this.$gateway = gateway;
        this.$evo = gateway.$evo;
        assert(this.$evo !== undefined && this.$evo.label == "EVO");
    }
    //-------------------------------------------------
    /**
     * Make an appropriate zone object
     * @param {int} i Index of zone
     * @returns {HeatZone}
     */
    makeZoneObject(i)
    {
        // I don't have examples for anything else, right now
        // but presumably there /could/ be one day
        return new HeatZone(this, this.zones[i]);
    }
    //-------------------------------------------------
    id() {
        return this.systemId;
    }
    //-------------------------------------------------
    zoneByName(name, mandatory=false) {
        for(let z of this.zones ) {
            if(z.name===name)
                return z;
            
        if(mandatory)
            throw new BadStructure(`No zone named [${name}]`);
        }        
    }
    //-------------------------------------------------
    zoneById(zid, mandatory=false) {
        assert(this.zones);
        for(let z of this.zones ) {
            // console.log(`Zone ${z.name} ${z.zoneId}`);
            if(z.zoneId===zid)
                return z;
        }    
        
        if(mandatory)
            throw new BadStructure(`No zone with id [${zid}]`);
    }
    //-------------------------------------------------
    *_zones() {
        for(let z of this.zones ) 
            yield z;
    }
    //-------------------------------------------------
    /**
     * Set system mode
     * @param {string} mode 
     * @param {time} until 
     */
    async setMode(mode, until) {
        
        if(until) {
            ft = `${until.getFullYear()}:${until.getMonth()}:${until.getDay()}T00:00:00Z`;
            var body = { 'SystemMode':mode, "TimeUntil": ft, 'Permenant' : false };
        } else {
            var body = { 'SystemMode':mode, "TimeUntil": undefined, 'Permenant' : true }            
        }
            
        
        let headers = await this.$evo.headers(true); 
        
        let uri = HONEYWELL + `WebAPI/emea/api/v1/temperatureControlSystem/${this.$system.id()}/mode`;
        console.log(`Mode  put to ${uri}`);
        this.$status = await req({
            method:'PUT',
            uri: uri,
            headers: headers,
            json: body
        });
    }
    //------------------------------------------------------------------
    /**
     * Set to normal, Auto mode, except if in permenant override
     */
    async setModeNormal(until) { await this.setMode('Auto', until); }

    /**
     * Set to Auto, even if in permenant override
     */
    async setModeReset(until) { await this.setMode('AutoWithReset', until); }

    
    async setModeCustom(until) { await this.setMode('Custom', until); }
    async setModeEco(until) { await this.setMode('AutoWithEco', until); }
    async setModeAway(until) { await this.setMode('Away', until); }
    async setModeDayOff(until) { await this.setMode('DayOff', until); }
    async setModeOff(until) { await this.setMode('HeatingOff', until); }
    //------------------------------------------------------------------
    /**
     * Do an operation set by a JSON-formatted string.
     * @param {json} cmdjson 
     */
    async doSystemCommand(cmd) {
        if( typeof cmd == "string")            
            cmd = JSON.parse(cmd);
        switch(cmd.command) {
            case "setmode":
                await this.setMode(cmd.mode, cmd.until);
                break;

            default:
                throw new Error(`Unsupported TemperatureController command [${cmd.command}]`);
        }
    }
    //------------------------------------------------------------------

};
//============================================================
class ZoneBase {
    constructor(sys)  {
        this.$system = sys;
        this.$evo = sys.$evo;
        assert(this.$evo !== undefined && this.$evo.label == "EVO");
    }
    //------------------------------------------------------------------
    /**
     * return compact status of zone
     * @returns {undefined|nm$_evo.HeatZone.state.evoAnonym$3}
     */
    state() {
        if(!this.status)
            return {
                temperature: undefined,
                isAvailable: undefined,
                setpoint: undefined,
                setpointMode: undefined,
                faults: undefined
            };
        
        return {
            temperature:  this.status.temperatureStatus.temperature,
            isAvailable:  this.status.temperatureStatus.isAvailable,
            setpoint:     this.status.setpointStatus.targetHeatTemperature,
            setpointMode: this.status.setpointStatus.setpointMode,
            faults:       this.status.activeFaults
        };
    }
    //------------------------------------------------------------------
    getURI() {
        return HONEYWELL + `WebAPI/emea/api/v1/${this.zone_type}/${this.zoneId}`;
    }
    //------------------------------------------------------------------
    /**
     * Get the schedule for the zone into $schedule, also return it.
     */
    async getSchedule()
    {
        let headers = await this.$evo.headers(); 
        let uri = this.getURI()+"/schedule";
        console.log(`Schedule get ${uri}`);
        let schedule = await req({
            method:'GET',
            uri: uri,
            headers: headers,
            json: true
        });

        this.$schedule = new DailySchedule(schedule, this.$evo.log);

        return this.$schedule;
    }
    //------------------------------------------------------------------
    async setSchedule(schedule) {

        let headers = await this.$evo.headers(); 
        headers['Content-Type'] = 'application/json';
        
        let uri = this.getURI()+"/schedule";
        this.$evo.log.info(`Schedule Put ${uri}`);
        this.$status = await req({
            method:'PUT',
            uri: uri,
            headers: headers,
            json: schedule
        });
        
    }
    //------------------------------------------------------------------
    /**
     * Do an operation set by a JSON-formatted string
     * @param {json} cmd 
     */
    async doZoneCommand(cmd) {
        if( typeof cmd == "string")            
            cmd = JSON.parse(cmd);

        switch(cmd.command) {
            // TODO 
            default:
                throw new Error(`Unsupported Zone command [${cmd.command}]`);
        }
    }
    //------------------------------------------------------------------
}
//============================================================
/**
 * Extend HeatingZone
 */
class HeatZone extends ZoneBase {
    constructor(sys, pjso)  {
        super(sys);
        Object.assign(this, pjso);
        this.zone_type = 'temperatureZone';
        assert(this.$evo !== undefined && this.$evo.label == "EVO");
    }
    //------------------------------------------------------------------
    /**
     * Do an operation set by a JSON-formatted string
     * @param {json} cmd 
     */
    async doZoneCommand(cmd) {
        if( typeof cmd == "string")            
            cmd = JSON.parse(cmd);

        switch(cmd.command) {
            case "Override":
                await this.setTemperature(cmd.setpoint, cmd.until);
                break;
6
            case "CancelOverride":
                await this.cancelTemperatureOverride();
                break;

            default:
                await super.doZoneCommand(cmd);
                break;
        }
    }
    //------------------------------------------------------------------
    /**
     * Set temperature override.
     * @param {Number} temperature Temperature to set
     * @param {Date?} until         Time to set till, undefined for perm or "next-switchpoint"
     */
    async setTemperature(temperature, until) {
        const data = {
                    "HeatSetpointValue": temperature
                    };

        if(until=="next-switchpoint") {
            let i = this.$schedule.iterator();
            until = i.switchpointDateTime();
        }                    

        if(until) {
            data.SetpointMode = "TemporaryOverride";
            data.TimeUntil = Evo.toDateTimeString(until);
        } else {
            data.SetpointMode = "PermanentOverride";
        }

        await this._setHeatSetpoint(data);        
    }

    //------------------------------------------------------------------
    async _setHeatSetpoint(data) {
        const uri = this.getURI() + "/heatSetpoint";
        const headers = await this.$evo.headers(true);
        this.$evo.log.info(`${JSON.stringify(data)} >>  ${uri}` );
        try
        {
            const status = await req({
                method:'PUT',
                uri: uri,
                headers: headers,
                json: data
            });
        } catch(e) {
            throw Error( `PUT failed to ${uri} reason=${e}\n data=${JSON.stringify(data)}\n hdr=${headers}` )
        }
    }
    //------------------------------------------------------------------
    async cancelTemperatureOverride() {
        const data = {
                "SetpointMode": "FollowSchedule",
                "HeatSetpointValue": 0.0
                };

        await this._setHeatSetpoint(data);        
    }
    //------------------------------------------------------------------
}
//============================================================
/*
{"dailySchedules":[
    {
        "dayOfWeek":"Monday",
        "switchpoints":[
            {"heatSetpoint":21,"timeOfDay":"08:00:00"},
            {"heatSetpoint":16,"timeOfDay":"17:30:00"},
            {"heatSetpoint":5,"timeOfDay":"22:30:00"}
            ]
    },
    ETC
]
}
*/

//============================================================
class ScheduleIterator {
    constructor(sched, atime, log) {
        let time = new Date(atime.getTime());
        this.schedule = sched;
        let seconds = time.getHours()*3600
                        + time.getMinutes()*60
                        + time.getSeconds()
                        ;

        this.baseday = new Date(atime.getTime());
        this.baseday.setHours(0,0,0,0);

        this.dow = (time.getDay()+6) % 7;  // js days start Sunday=0
        this.index = 0;
        this.dayoffset = 0;
        this.invalid = false;
        this.$log = log;
        this.adjust();
        while(this.dayoffset==0 && this.switchpoint().secondsInDay() < seconds)
            this.next();
    }

    //-------------------------------------------------------------------------
    adjust() {
        let c =0;
        while(!this.invalid) {
            //this.$log.info(`adj dow=${this.dow} ix=${this.index} of ${this.schedule.dailySchedules[this.dow].switchpoints.length}`);

            if(this.index < this.schedule.dailySchedules[this.dow].switchpoints.length)
                return;

            if(++c==8) {
                this.invalid = true;
                throw Error("No schedule found!");
                break;
            }
                

            ++this.dayoffset;
            ++this.dow;
            if(this.dow>6)
                this.dow=0;
            this.index = 0;
        }
    }

    //-------------------------------------------------------------------------
    /**
     * Advance to next switchpoint
     */
    next() {
        ++this.index;
        this.adjust();
    }

    //-------------------------------------------------------------------------
    /**
     * Get current switchpoint
     */
    switchpoint() {
        if(this.invalid) 
            return undefined;

        return this.schedule.dailySchedules[this.dow].switchpoints[this.index];
    }

    //-------------------------------------------------------------------------
    /**
     * get actual datetime of switchpoint
     */
    switchpointDateTime() {
        if(this.invalid) 
            return undefined;

        let sp = this.switchpoint();
        let dt = new Date(this.baseday.getTime());
        dt.setDate( dt.getDate() + this.dayoffset);
        dt.setSeconds(sp.secondsInDay());
        return dt;
    }
    //-------------------------------------------------------------------------

}
//============================================================
class DailySchedule {
    constructor(raw, log) {
        this.$log = log;
        if(raw) {
            Object.assign(this, raw);
            for(let i=0; i<this.dailySchedules.length; ++i) {
                this.dailySchedules[i] = new DaySchedule(this.dailySchedules[i]);
            }
        } else {
            this.dailySchedules = [];
            for (const day of DailySchedule.days() ) {
                this.dailySchedules.push(new DaySchedule(null,day));                    
            }
        }
    }
    //---------------------------------------------------------
    static days() {
        return [ "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
    }

    //---------------------------------------------------------
    /**
     * Get a day's schedule by index or by name. Monday is day 0
     * @param {*} ixOrName 
     */
    getDay(ixOrName) {
        if(typeof ixOrName == "number")
            return this.dailySchedules[ixOrName];

        for (const dsch of this.dailySchedules) {
            if(ixOrName.localeCompare(dsch.dayOfWeek, undefined, { sensitivity: 'base' }) === 0)
                return dsch;
        }
    }
    //---------------------------------------------------------
    /**
     * Unbounded Iterate switchpoints starting at next one.
     * @param {date} time 
     */
    iterator(time) {
        return new ScheduleIterator(this, time || new Date(), this.$log);
    }
    //---------------------------------------------------------
}
//============================================================
class DaySchedule {
    //---------------------------------------------------------
    constructor(raw,dow)
    {
        if(raw) {
            Object.assign(this, raw);
            for(let i=0; i<this.switchpoints.length; ++i) {
                this.switchpoints[i] = new HeatSwitchpoint(this.switchpoints[i]);
            }

        } else {
            this.switchpoints=[];
            this.dayOfWeek = dow;
        }
    }
    //---------------------------------------------------------
    /**
     * Create a new switch point, and add to this.switchpoints
     * @param {number} value 
     * @param {string} timeOfDay 
     */
    createSwitchPoint(value,timeOfDay) {
        let swp = new HeatSwitchpoint(null, value,timeOfDay);
        this.switchpoints.push(swp);
        this.rationaliseSwitchpoints(swp);
        return swp;
    }
    //---------------------------------------------------------
    /**
     * Sort the switchpoints, eliminating duplicate times.
     * 
     * You can pass any number of "keeper" switchpoints which
     * will be used in case of a duplicated time.
     * 
     */
    rationaliseSwitchpoints() {
        this.switchpoints.sort( (a,b) => a.timeOfDay.localeCompare(b.timeOfDay) );

        for(let i=this.switchpoints.length-2; i>=0; --i) {
            let a = this.switchpoints[i];
            let b = this.switchpoints[i+1];
            if( a.timeOfDay.localeCompare(b.timeOfDay) == 0) {
                // they are equal?
                if(arguments && arguments.indexOf(a) != -1 ) {
                    // keep a
                    this.switchpoints.splice(i+1,1);
                } else {
                    // keep b
                    this.switchpoints.splice(i,1);
                }
            }
        }
    }
    //---------------------------------------------------------
}
//============================================================
class HeatSwitchpoint {
    constructor(raw, value, timeOfDay) {
        if(raw) {
            Object.assign(this, raw);
        } else {
            this.heatSetpoint = value || 5.0;
            this.timeOfDay = timeOfDay || "00:00:00";
        }
    }

    /**
     * Set or Return switchpoint as number of seconds in the day
     */
    secondsInDay(set) {
        if(set==undefined) {
            let frags = this.timeOfDay.split(":");
            return Number(frags[0])*3600 + Number(frags[1])*60+Number(frags[2]);
        }
        const sec = set % 60;
        set = Math.floor(set/60);
        const min = set % 60;
        const hr = Math.floor(set/60);
        this.timeOfDay = sprintf.sprintf("%02d:%02d:%02d", hr, min, sec);
    }
}
//============================================================
module.exports = Evo;

