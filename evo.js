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
        
    }
    //--------------------------------------------------------
    /**
     * Get an access token, and build our commen headers
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
    async headers() {
        if(
                !this.access_token
                || !this.access_token_expires
                || new Date() > this.access_token_expires
        ) await this._basicLogin()
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
                this.$evo.setStructrueError(`Unknown gateway in status ${gws.gatewayId}`);
                continue;
            }
                
            gw.$status = gws;
            
            for(let css of gws.temperatureControlSystems) {
                let cs = gw.controlSystemById(css.systemId, false);
                if(!cs) {
                    this.$evo.setStructrueError(`Unknown Control System in status ${css.systemId}`);
                    continue;
                }
                cs.$status = css;
                
                for(let zs of css.zones) {
                    let z = cs.zoneById(zs.zoneId, false);
                    if(!z) {
                        this.$evo.setStructrueError(`Unknown Zone in status ${zs.zoneId}`);
                        continue;
                    }
                    z.status = zs; // note no $ prefix
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
        this.$evo = loc.evo;
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
        this.$evo = gateway.evo;
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
};
//============================================================
/**
 * Extend HeatingZone with some methods
 */
class HeatZone {
    constructor(sys, pjso)  {
        Object.assign(this, pjso);
        this.$system = sys;
        this.$evo = sys.evo;
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
            faults:       JSON.stringify(this.status.activeFaults)
        };
    }
    //------------------------------------------------------------------
    async setMode(mode, until) {
        
        if(until) {
            ft = `${until.getFullYear()}:${until.getMonth()}:${until.getDay()}T00:00:00Z`;
            var body = { 'SystemMode':mode, "TimeUntil": ft, 'Permenant' : false };
        } else {
            var body = { 'SystemMode':mode, "TimeUntil": undefined, 'Permenant' : true }            
        }
            
        
        let headers = await this.$evo.headers(); 
        headers['Content-Type'] = 'application/json';
        
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
    async setModeNormal(until) { await this.setMode('Auto',until); }
    async setModeReset(until) { await this.setMode('AutoWithReset',until); }
    async setModeCustom(until) { await this.setMode('Custom',until); }
    async setModeEco(until) { await this.setMode('AutoWithEco',until); }
    async setModeAway(until) { await this.setMode('Away',until); }
    async setModeDayOff(until) { await this.setMode('DayOff',until); }
    async setModeOffuntil() { await this.setMode('HeatingOff',until); }
    //------------------------------------------------------------------
};
//============================================================
module.exports = Evo;

