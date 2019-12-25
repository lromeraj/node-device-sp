const Log           = require('@lromeraj/log');
const BTSerial      = require('bluetooth-serial-port');

class Device {

  constructor( src ) {

    this.name = 'dev1';
    this.addr = '00:00:00:00:00:00';
    this.trail_char = '\n';
    this.max_reconnect_attemps = 10;
    this.reconnect_attemps = 0;
    this.alive_msg = 'alive';
    this.alive_timeout = 2000;
    this.connected = false;
    this.retry_after_disconnect = false;

    Object.assign( this, src );

    this._functions = {}; // user custom functions
    this._events = { // device events
      _ondata: [],
      _onerror: [],
      _onconnect: [],
      _ondisconnect: [],
      _onwrite: [],
      _onalive: [],
      _onpair: []
    };

    this._alive_timeout = null;
    this._open_timeout = null;


    this._buff = '';
    this._btSerial = null;

  }


  static errc( key ) {

    const errs = {
      CANT_CONNECT: 1
    };

    return ( errs[ key ] || -1 );
  }

  disconnect() {

    this.connected = false;
    this._btSerial = null;

    this._emit({
      e: 'disconnect'
    });

  }

  connect() {


    if ( this._btSerial == null ) {

      this._btSerial = new (BTSerial).BluetoothSerialPort();

      this._btSerial.on( 'data', ( data ) => {

        let str = data.toString();

        for ( let i=0; i < str.length; i++ ) {

          let addChar = true;
          let code = str.charCodeAt( i );

          if ( code == 10 || code == 13 ) addChar = false;

          if ( code == 13 ) {

            if ( this.alive_msg == this._buff ) {

              if ( !this.connected ) {

                this._emit({
                  e: 'connect'
                });

                this.connected = true;
              }

              clearTimeout( this._open_timeout );
              clearTimeout( this._alive_timeout );

              this._emit({
                e: 'alive'
              });

              this._alive_timeout = setTimeout( () => {

                this.disconnect();

                if ( this.retry_after_disconnect ) {
                  this.reconnect_attemps = 0;
                  this.connect();
                }
              }, this.alive_timeout );

            }

            this._emit({
              e: 'data',
              args: [ this._buff ]
            });

            this._buff = '';

          }

          if ( addChar === true ) this._buff += str[ i ];

        }

      });



    }


    const open = () => {

      this._btSerial.connect( this.addr, 1, () => {

        this._emit({
          e: 'pair'
        })

      }, () => {

        if ( this.reconnect_attemps < this.max_reconnect_attemps ) {

          this._emit({
            e: 'error',
            args: [{
              code: Device.errc( 'CANT_CONNECT' ),
              data: {
                attemp: this.reconnect_attemps+1
              }
            }]
          });

          this.reconnect_attemps++;
          this.connect();

        }


      });

    }

    this._open_timeout = setTimeout( open, 3000 );

    return this;

  }

  get isConnected() {
    return this.connected;
  }

  createFunction( name, fn ) {

    if ( typeof fn != 'function' ) return this;


    if (  this._functions[ name ] === undefined &&
          this._events[ '_on' + name ] === undefined ) {

      this._functions[ name ] = fn;
      this._events[ '_on' + name ] = [];

    }

    return this;

  }

  callFunction( name, args ) {

    if ( args !== undefined ) {
      args = args instanceof Array ? args : [ args ];
    }

    let fn = this._functions[ name ];
    let ret = undefined;

    if ( fn ) {

      ret = fn.apply( this, args );

      this._emit({
        e: name,
        args: args
      });

    }

    return ret === undefined ? this : ret;

  }

  write( str ) {

    this._btSerial.write( Buffer.from( str, 'utf-8'), ( err, bytes ) => {

    });

    this._emit({
      e: 'write',
      args: [str]
    });

    return this;
  }

  removeListener( e, fn ) {
    ( this._events[ '_on' + e ] || [] ).forEach( ( _fn, i ) => {
      if ( _fn == fn )
      this.events[ '_on' + e ].splice( i, 1 );
    });
    return this;
  }

  on( e, fn ) {
    ( this._events[ '_on' + e ] || [] ).push( fn );
    return this;
  }

  _emit( src ) {

    let args  = src.args instanceof Array ? src.args : [ src.args ],
        ctx   = src.ctx || null,
        e     = src.e;


    ( this._events[ '_on'+ e ] || [] ).forEach( fn => {
      fn.apply( ctx, args );
    });


    return this;

  }

}




module.exports = Device;
