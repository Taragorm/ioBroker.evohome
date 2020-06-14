'use strict';

/*
 * Created with @iobroker/create-adapter v1.8.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');


// Load your modules here, e.g.:
// const fs = require("fs");
const Evo = require('./evo.js');

const POLL_MIN_S = 60;

class EvoAdaptor extends utils.Adapter {

    //----------------------------------------------------------------------------------------------
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'evohome',
        });
        this.on('ready', this.onReady);
        this.on('objectChange', this.onObjectChange);
        this.on('stateChange', this.onStateChange);
        // this.on("message", this.onMessage);
        this.on('unload', this.onUnload);

        this.setHandlers = {};
        this.pfxlen = this.namespace.length+1;
    }

    //----------------------------------------------------------------------------------------------
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    async onReady() {
        try
        {
            // Initialize your adapter here
            this.log.info("onReady()");
            
            this.unit = "C";
            
            this.log.info(`Starting user=[${this.config.username}] pass=[${this.config.password}]`);
            this.evo = new Evo( this.config.username, this.config.password);
            this.evo.log = this.log;
            this.evo.onCommand = (ev) => this.evoCommandSent(ev);
            
            let ms = (this.config.pollSeconds || POLL_MIN_S)*1000;
            if(ms<POLL_MIN_S*1000) {
                ms = POLL_MIN_S*1000;
                this.config.pollSeconds = POLL_MIN_S;
                this.log.warn(`Poll rate too fast; set to ${POLL_MIN_S}s`);
            }


            await this.makeState( "errmsg", "Error Message", "string", ""  );
            await this.makeState( "error", "Error State", "boolean", ""  );
            await this.setErrorMessage("Initialising");

            this.needConnect = "Init";
            this.log.info(`Starting poll at ${ms}ms`);
            this.poll_promise = this.poller(ms);  // not awaited...
            //this.timer = setInterval( () => this.tick(), ms );
           // this.tick();
            
        } catch(ex) {
          this.log.error(ex.stack);  
        }
        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        //this.log.info('config test1: ' + this.config.option1);
        //this.log.info('config test1: ' + this.config.option2);

        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */
        /*
        await this.setObjectAsync('testVa                        let gsid = this.GSId(gw,cs);
riable', {
            type: 'state',
            common: {
                name: 'testVariable',
                type: 'boolean',
                role: 'indicator',
                read: true,
                write: true,
            },
            native: {},
        });
        */
        
        // in this template all states changes inside the adapters namespace are subscribed
        //this.subscribeStates('*');

        /*
        setState examples
        you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
        */
        // the variable testVariable is set to true as command (ack=false)
        //await this.setStateAsync('testVariable', true);

        // same thing, but the value is flagged "ack"
        // ack should be always set to true if the value is received from or acknowledged from the target system
        //await this.setStateAsync('testVariable', { val: true, ack: true });

        // same thing, but the state is deleted after 30s (getState will return null afterwards)
        //await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

        // examples for the checkPassword/checkGroup functions
        //let result = await this.checkPasswordAsync('admin', 'iobroker');
        //this.log.info('check user admin pw ioboker: ' + result);

        //result = await this.checkGroupAsync('admin', 'admin');
        //this.log.info('check group user admin group admin: ' + result);
    }
    //----------------------------------------------------------------------------------------------
    async setErrorMessage(msg){
        await this.setStateAsync("errmsg",  { val: msg, ack: true} );
        await this.setStateAsync("error",  { val: Boolean(msg), ack: true} );
    }
    //----------------------------------------------------------------------------------------------
    sleepMs(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    //----------------------------------------------------------------------------------------------
    /**
     * Fired when a command is sent to the remote system.
     * @param {*} ev 
     */
    async evoCommandSent(ev)
    {

        switch(ev.cmd) {
        
        case "setheatsetpoint":
            await this.sleepMs(4000);
            this.log.info("Refresh due to set heat")
            await this.mergeStatus(true);
            break;

        case "setmode":
            await this.sleepMs(4000);
            this.log.info("Refresh due to set mode")
            await this.mergeStatus(true);
            break;

        case "setschedule":
            default:
                break;
        }
    }
    //----------------------------------------------------------------------------------------------
    /**
     * Create a combined gateway/Control sysyem id
     * @param {gateway} gt 
     * @param {controlSystem} cs 
     */
    GSId(gt,cs) {
        if(!this.config.simpleTree)
            return "." + gt.id() + "-" + cs.id();
        return "";
    }    
    //----------------------------------------------------------------------------------------------
    async poller(ms) {
        for(;;) {
            try {
                //this.log.info("polling");
                await this.work();
                await this.setErrorMessage("");
                //this.log.info("...done");
            } catch(err) {
                let msg=  err.message || "?ERROR?";
                try {
                    let o = JSON.parse(err.message);                    
                    msg = o.error ? o.error : err.message;
                }
                catch(ex) {}

                this.writeErrorStates( err.message || "?UNK?" );
                this.log.error(err.stack); 
                this.needConnect = "Worker Error:" + err;
            }
            //this.log.info("...sleep");
            await this.sleepMs(ms);
            //this.log.info("...wake");
        }
    }
    //----------------------------------------------------------------------------------------------
    /**
     * Walk over all our state points, and set an additional "error" property.
     * @param {string} msg 
     */
    async writeErrorStates(msg)
    {
/*
    {
        "type": "state",
        "common": {
            "name": "Laser Operational",
            "type": "boolean",
            "role": "Value",
            "read": true,
            "unit": "",
            "write": true
        },
        "native": {},
        "from": "system.adapter.shed.0",
        "ts": 1553252313931,
        "_id": "shed.0.state.relay"
    },
 */        
        this.log.info(`Checking states for statuses`);
        await this.setErrorMessage(msg);
        let states = await this.getStatesOfAsync();
        for (const strec of states) {
            this.log.info(`Checking state ${strec._id}`);
            if(strec._id.endsWith(".state") || strec._id.endsWith(".zone")){
                let id = strec._id.substr(this.pfxlen);
                this.log.info(` ...reading ${id}`);
                let vs = await this.getStateAsync(id);
                this.log.info(` ...got ${vs.val}`);
                let v = JSON.parse(vs.val);
                v.error = msg;
                let ws = JSON.stringify(v);
                this.log.info(`... for ${id} writing back ${ws}`);
                await this.setStateAsync(id,  { val: ws, ack: true} );
            }
        }
    }
    //----------------------------------------------------------------------------------------------
    /**
     * Main cyclic work task
     */
    async work() {
        if(this.needConnect) {
            this.log.info(`(Re)Connect due to ${this.needConnect}`);
            await this.evo.login();
            this.needConnect = "";
            await this.initObjects();
            this.log.info("Connected ok");
        }

        if(this.needConnect) 
            return;
        
        await this.mergeStatus();
        
        if(this.evo.structureError) {
            this.log.info(`Structure refresh due to ${this.evo.structureError}`);
            this.needConnect = "StructureError";
            await this.initObjects();
            // catch the update next time...
        }
    }
    //----------------------------------------------------------------------------------------------
    /**
     * Move the evo data to iob
     * @param {boolean} quick   Don't get schedules
     */
    async mergeStatus(quick,nofetch) {
        if(!nofetch) 
            await this.evo.getStatus(quick);

        for(let loc of this.evo.locations()) {
            for(let gw of loc.gateways) {
                for(let cs of gw.systems()) {
                    let gsid = this.GSId(gw,cs);
                    let channel = loc.name()+gsid;

                    for(let zn of cs._zones()) {
                        let sensor = channel+"."+zn.name+".";
                        let st = zn.state();
                        
                        let ss = (name) => {  this.setState(sensor+name, { val: st[name], ack: true }) };
                        
                        ss("temperature");
                        ss("isAvailable");
                        ss("setpoint");
                        ss("setpointMode");
                        ss("faults");

                        this.setState(sensor+"zone", { val: JSON.stringify(st), ack: true});
                        this.setState(sensor+"schedule", { val: JSON.stringify(zn.$schedule), ack: true});
                    }

                    if(gsid) { 
                        // multiple systems
                        this._makeSystemStatus(channel, cs);
                    } else {
                        // single system
                        this._makeSystemStatus(loc.name(), cs);
                    }

                }
            }
        }
    }
    //----------------------------------------------------------------------------------------------
    /**
     * Create and write an evo system status to iobroker
     * @param {string} iobref   Place to write IOB status (actually the object under the status)
     * @param {*} evosys        EVO system node
     */
    _makeSystemStatus(iobref, evosys)
    {
        let zunav = [];
        let zflt = [];
        let znsched = [];

        for(let z of evosys._zones()) {
            if(z.status)
            {
                if(!z.status.temperatureStatus.isAvailable)
                    zunav.push(z.name);

                if(z.status.activeFaults.length>0)
                    zflt.push(z.name);

                if(z.status.setpointStatus.setpointMode != "FollowSchedule")
                    znsched.push(z.name);
            }    
        }

        let status = {
            "mode": evosys.$status.systemModeStatus.mode,
            "isPermanent": evosys.$status.systemModeStatus.isPermanent,
            "until": evosys.$status.systemModeStatus.timeUntil,
            "sysfaults": evosys.$status.activeFaults,
            "zn_unavail": zunav,
            "zn_fault": zflt,
            "zn_notsched": znsched
        };

        let ss = JSON.stringify(status);
        //this.log.info(`Writing status ${iobref+".status"} as ${ss}`);
        this.setState(iobref+".status", { val: ss, ack: true});
    }
    //----------------------------------------------------------------------------------------------    
    /**
     * Create iob objects and states
     */
    async initObjects() {
        const that = this;

        if(!this.evo.installation) {
            this.log.error("No Install data found!");
            this.needConnect = "No Loc";
            return;
        }

        for(let loc of this.evo.locations()) {

            this.log.info(`Create Loc ${loc.name()}`)

            await this.makeObj("device",loc.name());

            if(this.config.simpleTree) {
                // single system 
                await this.makeState( loc.name()+".cmd", "Command Point", "string", "json", 
                                    function(cmd,id) { that.onLocationCommand(loc,cmd,id); }  
                                    );

                await this.makeState( loc.name()+".status", "System status", "string", "json"  );
            }

            for(let gw of loc.gateways) {
                for(let cs of gw.systems()) {
                    let gsid = this.GSId(gw,cs);
                    let channel = loc.name() +gsid;
                    if(gsid) {
                        // we have more than one system
                        await this.makeObj("channel",channel);
                        await this.makeState( channel+".status", "System status", "string", "json"  );
                        await this.makeState( channel+".cmd", "Command Point", "string", "json", 
                            function(cmd,id) { that.onLocationCommand(zn,cmd,id); }  
                            );
                    }
                    
                    for(let zn of cs._zones()) {

                        this.log.info(`Create Zn ${zn.name}`)

                        zn.$oid = channel+"."+zn.name;
                        let sensor = zn.$oid;
                        await this.makeObj("sensor",sensor);
                        sensor += ".";
                        await this.makeState( sensor+"temperature", "temperature", "number", this.unit );
                        await this.makeState( sensor+"isAvailable", "isAvailable", "boolean" );
                        await this.makeState( sensor+"force_setpoint", "Forced Setpoint", "number", this.unit,
                                                function(cmd,id) { that.onForceSetpoint(zn,cmd,id); }  
                                                );
                        await this.makeState( sensor+"setpoint", "Current Setpoint", "number", this.unit );
                        await this.makeState( sensor+"setpointMode", "Setpoint Mode", "string"  );
                        await this.makeState( sensor+"faults", "faults", "string"  );
                        await this.makeState( sensor+"schedule", "Zone Schedule", "string", "json"  );
                        await this.makeState( sensor+"zone", "Zone as JSON", "string", "json"  );
                        await this.makeState( sensor+"zone_cmd", "Zone Command Point", "string", "json", 
                                                function(cmd,id) { that.onZoneCommand(zn,cmd,id); }  
                                                );
                    }
                }
            }
        }
    }
    
    //--------------------------------------------------------------------
    async makeState(id, name, type, unit="",  wr=false, role="Value",) {

        //this.log.info(`Making state ${id}` );
        await this.setObjectNotExistsAsync(id, {
            type: "state",
            common: {
                name: name,
                type: type,
                role: role,
                read: true,
                unit: unit,
                write: Boolean(wr),
            },
            native: {},
        });

        if(wr) {
            //this.log.info(`Setting write handler for ${id}` );
            this.subscribeStates(id);
            this.setHandlers[id] = wr;
        }
    }    
        
    //--------------------------------------------------------------------
    async onLocationCommand(loc, state, id) {
        this.log.info(`OnLocCmd ${id} = ${state.val}`);
        try {
            await loc.doSystemCommand(state.val);
        } catch(e) {
            this.log.error(e.stack);
        }
    }
    //--------------------------------------------------------------------
    async onForceSetpoint(zn, state, id) {
        this.log.info(`onForceSetpoint ${id} = ${state.val}`);
        if(state.val) {
            await zn.doZoneCommand({
                command: "Override",
                setpoint: state.val
                });
        } else {
            await zn.doZoneCommand({
                command: "CancelOverride"
                });
        }
    }
    //--------------------------------------------------------------------
    async onZoneCommand(zn, state, id) {
        this.log.info(`OnZoneCmd ${id} = ${state.val}`);
        try {
            let cj = JSON.parse(state.val);
            await zn.doZoneCommand(cj);

            if(cj.command=="SetSchedule") {
                // forcibly update the schedule point
                await this.mergeStatus(null, /* no fetch= */ true); 
                //this.setState(zn.$oid + ".schedule", { val: JSON.stringify(cj.schedule), ack: true});
            }
        } catch(e) {
            this.log.error(e.stack);
        }
    }
    //--------------------------------------------------------------------
    async makeObj(type, name) {
        this.log.debug(`Making ${type} ${name}` );
        
        await this.setObjectNotExistsAsync(name, {
            type: type,
            common: {
                name: name,
            },
            native: {},
        });
        //this.log.info("done");
    }            
    //--------------------------------------------------------------------
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        
        if(this.timer) {
            //clearInterval(this.timer);
            //this.timer = undefined;
        }
        
        try {
            this.log.info('cleaned everything up...');
            callback();
        } catch (e) {
            callback();
        }
    }

    //--------------------------------------------------------------------
    /**
     * Is called if a subscribed object changes
     * @param {string} id
     * @param {ioBroker.Object | null | undefined} obj
     */
    onObjectChange(id, obj) {
        if (obj) {
            // The object was changed
            this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
        } else {
            // The object was deleted
            this.log.info(`object ${id} deleted`);
        }
    }

    //--------------------------------------------------------------------
    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        
        id = id.substr(this.pfxlen);

        if (state) {
            // The state was changed
            const fn = this.setHandlers[id];
            if(fn)
                fn(state,id)
            else
                this.log.error(`State ${id} changed: ${state.val} (ack = ${state.ack}) - but no handler is registered!`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    //--------------------------------------------------------------------
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    // 	if (typeof obj === "object" && obj.message) {
    // 		if (obj.command === "send") {
    // 			// e.g. send email or pushover or whatever
    // 			this.log.info("send command");

    // 			// Send response in callback if required
    // 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
    // 		}
    // 	}
    // }

}
//======================================================================

if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new EvoAdaptor(options);
} else {
    // otherwise start the instance directly
    new EvoAdaptor();
}
