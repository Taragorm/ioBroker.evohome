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
    }

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
            
            let ms = (this.config.pollSeconds || POLL_MIN_S)*1000;
            if(ms<POLL_MIN_S*1000) {
                ms = POLL_MIN_S*1000;
                this.config.pollSeconds = POLL_MIN_S;
                this.log.warn(`Poll rate too fast; set to ${POLL_MIN_S}s`);
            }
            
            this.log.info(`Starting poll at ${ms}ms`);
            this.timer = setInterval( () => this.tick(), ms );
            
            this.needConnect = "Init";
            this.tick();
            
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
    GSId(gt,cs) {
        if(!this.config.simpleTree)
            return "." + gt.id() + "-" + cs.id();
        return "";
    }
    
    //----------------------------------------------------------------------------------------------
    /**
     * Cyclic call here - polls evohome..
     */
    tick() {
        //this.log.info("Polling");
        this.work()
            .catch( (err) => { 
                this.log.error(err.stack); 
                this.needConnect = "Worker Error:" + err;
            })
            ;
        
        //this.log.info("Done Polling");
    }
    
    //----------------------------------------------------------------------------------------------
    async work() {
        if(this.needConnect) {
            this.log.info(`(Re)Connect due to ${this.needConnect}`);
            await this.evo.login();
            await this.initObjects();
            this.needConnect = "";
            this.log.info("Connected ok");
        }
        
        await this.mergeStatus();
        
        if(this.evo.structureError) {
            this.log.info(`Structure refresh due to ${this.evo.structureError}`);
            await this.initObjects();
            // catch the update next time...
        }

    }
    //----------------------------------------------------------------------------------------------
    async mergeStatus() {
        await this.evo.getStatus();
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
                    }
                }
            }
        }
    }
    //----------------------------------------------------------------------------------------------
    async initObjects() {
        
        for(let loc of this.evo.locations()) {
            await this.makeObj("device",loc.name());
            for(let gw of loc.gateways) {
                for(let cs of gw.systems()) {
                    let gsid = this.GSId(gw,cs);
                    let channel = loc.name() +gsid;
                    if(gsid)
                        await this.makeObj("channel",channel);
                    
                    for(let zn of cs._zones()) {
                        let sensor = channel+"."+zn.name;
                        await this.makeObj("sensor",sensor);
                        sensor += ".";
                        await this.makeState( sensor+"temperature", "temperature", "number", this.unit );
                        await this.makeState( sensor+"isAvailable", "isAvailable", "boolean" );
                        await this.makeState( sensor+"setpoint", "setpoint", "number", this.unit, true );
                        await this.makeState( sensor+"setpointMode", "setpointMode", "string"  );
                        await this.makeState( sensor+"faults", "faults", "string"  );
                        await this.makeState( sensor+"zone", "Zone as JSON", "string", "json"  );
                        await this.makeState( sensor+"zone_cmd", "Zone Command Point", "string", "json", true  );
                    }
                }
            }
        }
    }
    
    //--------------------------------------------------------------------
    async makeState(id, name, type, unit="",  wr=false, role="Value",) {

        this.log.debug(`Making state ${id}` );
        await this.setObjectNotExistsAsync(id, {
            type: "state",
            common: {
                name: name,
                type: type,
                role: role,
                read: true,
                unit: unit,
                write: wr,
            },
            native: {},
        });
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
            clearInterval(this.timer);
            this.timer = undefined;
        }
        
        try {
            this.log.info('cleaned everything up...');
            callback();
        } catch (e) {
            callback();
        }
    }

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

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

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
