/*
$LicenseInfo:firstyear=2010&license=mit$

Copyright (c) 2010, Linden Research, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
$/LicenseInfo$
*/

"use strict";

const DOMParser = require('xmldom').DOMParser;
const atob = require('abab').atob;
const btoa = require('abab').btoa;

 //
 // LLSD Type          ECMAScript Type
 // ------------------ ---------------
 // Undefined          null
 // Boolean            Boolean
 // Integer            Number
 // Real               Number
 // UUID               UUID
 // String             String
 // Date               Date
 // URI                URI
 // Binary             Binary
 // Map                Object
 // Array              Array
 //

module.exports = (function()
{
    //
    // var u = new URI("http://www.example.com");
    // u.toString() // -> "http://www.example.com"
    // u.toJSON()   // -> "http://www.example.com"
    //
    const URI = function (val)
    {
        if (typeof val === 'undefined')
        {
            this.uri = '';
        }
        else if (/^(|([A-Za-z][A-Za-z0-9+\-.]*):([A-Za-z0-9\-._~:\/?#\[\]@!$&\'()*+,;=]|%[A-Fa-f0-9]{2})+)$/.test(val))
        {
            this.uri = String(val);
        }
        else
        {
            throw new TypeError('Invalid URI');
        }
    };

    URI.prototype.toString = function ()
    {
        return this.uri;
    };

    URI.prototype.toJSON = function ()
    {
        return this.uri;
    };

    //
    // var u = new UUID(); // 00000000-0000-0000-0000-000000000000
    // var u = new UUID([ 0x00, 0x01, 0x02 ... 0x0f ]);
    // var u = new UUID("12345678-1234-1234-1234-123456789abc");
    // u.toString() // UUID string
    // u.toJSON()   // UUID string
    // u.getOctets() // [ 0x00, 0x01, 0x02 ... 0x0f ]
    //
    const UUID = function (val)
    {
        function hex2(b)
        {
            return ('00' + b.toString(16)).slice(-2);
        }

        if (typeof val === 'undefined')
        {
            this.uuid = '00000000-0000-0000-0000-000000000000';
        }
        else if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(val))
        {
            this.uuid = String(val).toLowerCase();
        }
        else if (typeof val === 'object' && val instanceof Array)
        {
            if (val.length !== 16)
            {
                throw new Error('Invalid UUID array length');
            }
            var uuid  =
                    hex2(val[0]) + hex2(val[1]) + hex2(val[2]) + hex2(val[3]) + '-' +
                    hex2(val[4]) + hex2(val[5]) + '-' +
                    hex2(val[6]) + hex2(val[7]) + '-' +
                    hex2(val[8]) + hex2(val[9]) + '-' +
                    hex2(val[10]) + hex2(val[11]) + hex2(val[12]) + hex2(val[13]) +
                    hex2(val[14]) + hex2(val[15]);
            this.uuid = uuid.toLowerCase();
        }
        else
        {
            throw new TypeError('Expected string or array');
        }
    };

    UUID.prototype.toString = function ()
    {
        return this.uuid;
    };

    UUID.prototype.toJSON = function ()
    {
        return this.uuid;
    };

    UUID.prototype.getOctets = function ()
    {
        var string = this.uuid.replace(/-/g, ''),
            octets = [], i;
        for (i = 0; i < 16; i += 1)
        {
            octets[i] = parseInt(string.substring(i * 2, i * 2 + 2), 16);
        }
        return octets;
    };

    //
    // var b = new Binary(); // length 0
    // var b = new Binary( octets ); // Array of numbers
    // var b = new Binary( binary ); // Clone constructor
    // var b = new Binary( string, encoding );
    //
    // b.toString() // string line "[Binary <length>]"
    // b.toString( encoding ) // encoding of octets
    // b.toJSON()   // base64 encoding of octets
    // b.toArray() // Array of octets (a copy)
    //
    // Supported encodings are "UTF-8", "BASE64", "BASE16", "BINARY"
    // Unsupported encodings or invalid data will throw
    // a RangeError.
    //
    // *TODO: Track updates to CommonJS proposals for Binary data API
    //
    (function ()
    {

        // Convert binary string (each octet stored as character 0x00-0xff) to array of numbers
        function binstr_to_array(s)
        {
            var a = [], len = s.length, i, c;
            for (i = 0; i < len; i += 1)
            {
                c = s.charCodeAt(i);
                if (c > 0xff)
                {
                    throw new RangeError("Invalid byte value");
                }
                a[i] = c;
            }
            return a;
        }

        // Convert array of numbers to binary string (each octet stored as character 0x00-0xff)
        function array_to_binstr(a)
        {
            var s = [], len = a.length, i, c;
            for (i = 0; i < len; i += 1)
            {
                c = a[i];
                if (c > 0xff)
                {
                    throw new RangeError("Invalid byte value");
                }
                s.push(String.fromCharCode(c));
            }
            return s.join("");
        }

        var encodings = {
            "BINARY": {
                encode: binstr_to_array,
                decode: array_to_binstr
            },

            "UTF-8": {
                encode: function (s)
                        {
                            /*jslint bitwise: false*/
                            var o = [], len, i, cp, cp2;

                            function utf8(cp)
                            {
                                if (0x0000 <= cp && cp <= 0x007F)
                                {
                                    o.push(cp);
                                }
                                else if (0x0080 <= cp && cp <= 0x07FF)
                                {
                                    o.push(0xC0 | ((cp >> 6) & 0x1F));
                                    o.push(0x80 | ((cp >> 0) & 0x3F));
                                }
                                else if (0x0800 <= cp && cp <= 0xFFFF)
                                {
                                    o.push(0xE0 | ((cp >> 12) & 0x0F));
                                    o.push(0x80 | ((cp >> 6) & 0x3F));
                                    o.push(0x80 | ((cp >> 0) & 0x3F));
                                }
                                else if (0x10000 <= cp && cp <= 0x10FFFF)
                                {
                                    o.push(0xF0 | ((cp >> 18) & 0x07));
                                    o.push(0x80 | ((cp >> 12) & 0x3F));
                                    o.push(0x80 | ((cp >> 6) & 0x3F));
                                    o.push(0x80 | ((cp >> 0) & 0x3F));
                                }
                            }

                            len = s.length;

                            for (i = 0; i < len; i += 1)
                            {
                                cp = s.charCodeAt(i);

                                // Look for surrogate pairs
                                if (0xD800 <= cp && cp <= 0xDBFF)
                                {
                                    i += 1;
                                    if (i >= len)
                                    {
                                        throw new RangeError("Badly formed UTF-16 surrogate pair");
                                    }

                                    cp2 = s.charCodeAt(i);
                                    if (0xDC00 <= cp2 && cp2 <= 0xDFFF)
                                    {
                                        cp = ((cp & 0x03FF) << 10 | (cp2 & 0x03FF)) + 0x10000;
                                    }
                                    else
                                    {
                                        throw new RangeError("Badly formed UTF-16 surrogate pair");
                                    }
                                }
                                else if (0xDC00 <= cp && cp <= 0xDFFF)
                                {
                                    throw new RangeError("Badly formed UTF-16 surrogate pair");
                                }
                                utf8(cp);
                            }

                            return o;
                        },

                decode: function (a)
                        {
                            /*jslint bitwise: false, plusplus: false*/
                            var s = [], offset = 0, len = a.length, cp;

                            function cb()
                            {
                                if (offset >= len)
                                {
                                    throw new RangeError("Truncated UTF-8 sequence");
                                }

                                var b = a[offset++];
                                if (b < 0x80 || b > 0xBF)
                                {
                                    throw new RangeError("Invalid UTF-8 continuation byte");
                                }

                                return b & 0x3F;
                            }

                            while (offset < len)
                            {

                                cp = a[offset++];
                                if (0xC2 <= cp && cp <= 0xDF)
                                {
                                    cp = ((cp & 0x1F) << 6) | cb();
                                }
                                else if (0xE0 <= cp && cp <= 0xEF)
                                {
                                    cp = ((cp & 0x0F) << 12) | (cb() << 6) | cb();
                                }
                                else if (0xF0 <= cp && cp <= 0xF4)
                                {
                                    cp = ((cp & 0x07) << 18) | (cb() << 12) | (cb() << 6) | cb();
                                }
                                else if (!(0x00 <= cp && cp <= 0x7F))
                                {
                                    throw new RangeError("Invalid UTF-8 lead byte");
                                }

                                // Surrogate-pair encode
                                if (cp >= 0x10000)
                                {
                                    cp -= 0x10000;
                                    s.push(String.fromCharCode(0xD800 + ((cp >> 10) & 0x3FF)),
                                        String.fromCharCode(0xDC00 + (cp & 0x3FF)));
                                }
                                else
                                {
                                    s.push(String.fromCharCode(cp));
                                }
                            }

                            return s.join("");
                        }
            },

            'BASE64': {
                // NOTE: encode/decode sense is reversed relative to normal usage;
                // a base64 encoder typically encodes binary to a string.
                encode: function (s)
                        { // string -> binary
                            s = s.replace(/\s+/g, ''); // remove whitespace

                            try
                            {
                                return binstr_to_array(atob(s));
                            }
                            catch (e)
                            {
                                throw new RangeError("Invalid base64 sequence");
                            }
                        },

                decode: function (a)
                        { // binary -> string
                            return btoa(array_to_binstr(a));
                        }
            },

            'BASE16': {
                encode: function (s)
                        {
                            s = s.replace(/\s+/g, ''); // remove whitespace

                            if (!/^([0-9A-Fa-f]{2})*$/.test(s))
                            {
                                throw new RangeError("Invalid base16 sequence");
                            }

                            var out = [], i, o, len = s.length;
                            for (i = 0, o = 0; i < len; o += 1, i += 2)
                            {
                                out[o] = parseInt(s.substring(i, i + 2), 16);
                            }
                            return out;
                        },

                decode: function (a)
                        {
                            var s = [], len = a.length, i, c;
                            for (i = 0; i < len; i += 1)
                            {
                                c = a[i];
                                s.push(('00' + c.toString(16)).slice(-2).toUpperCase());
                            }
                            return s.join("");
                        }
            }
        };

        function get_encoding(name)
        {
            name = String(name).toUpperCase();
            if (encodings.hasOwnProperty(name))
            {
                return encodings[name];
            }
            throw new RangeError("unknown encoding: " + name);
        }

        const Binary = function ()
        {
            /*jslint bitwise: false*/

            var array, binary, string, encoding;

            // new Binary()
            if (arguments.length === 0)
            {
                this.octets = [];
            }

            // new Binary( array )
            else if (arguments.length >= 1 &&
                arguments[0] instanceof Array)
            {
                array       = arguments[0];
                this.octets = array.map(function (b)
                {
                    return (b >>> 0) & 0xff;
                });
            }

            // new Binary( binary )
            else if (arguments.length >= 1 &&
                arguments[0] instanceof Binary)
            {

                binary      = arguments[0];
                this.octets = binary.octets.slice();
            }

            // new Binary( string, encoding )
            else if (arguments.length >= 2 &&
                typeof arguments[0] === 'string' &&
                typeof arguments[1] === 'string')
            {

                string   = arguments[0];
                encoding = arguments[1];

                this.octets = get_encoding(encoding).encode(string);
            }

            else
            {
                throw new TypeError('Unexpected argument type(s)');
            }
        };

        // toString()
        // toString( encoding )
        Binary.prototype.toString = function (encoding)
        {
            if (arguments.length === 0)
            {
                return "[Binary " + this.octets.length + "]";
            }
            else
            {
                encoding = String(encoding);
                return get_encoding(encoding).decode(this.octets);
            }
        };

        // toJSON()
        Binary.prototype.toJSON = function ()
        {
            //return this.octets;
            // per mailing list proposal, serialize as base64 instead
            // to take advantage of string<->binary conversions
            // *TODO: Update when Type System draft is updated
            // *TODO: Consider moving this to JSON.stringify() call
            return this.toString('BASE64');
        };

        // toArray()
        Binary.prototype.toArray = function ()
        {
            return this.octets.slice(); // Make a copy
        };

    }());

    //
    // LLSD.parse( content_type, string )
    // LLSD.parseBinary( Binary )
    // LLSD.parseXML( string )
    // LLSD.parseJSON( string )
    // LLSD.parseNotation( string ) // (if LL_LEGACY set)
    //
    // LLSD.format( content_type, data )
    // LLSD.formatBinary( data ) // Binary
    // LLSD.formatXML( data ) // string
    // LLSD.formatJSON( data ) // string
    // LLSD.formatNotation( data ) // (if LL_LEGACY set)
    //
    // LLSD.asUndefined( value )
    // LLSD.asBoolean( value )
    // LLSD.asInteger( value )
    // LLSD.asReal( value )
    // LLSD.asString( value )
    // LLSD.asUUID( value )
    // LLSD.asDate( value )
    // LLSD.asURI( value )
    // LLSD.asBinary( value )
    //
    // Helpers:
    //
    // LLSD.parseISODate(str) // returns date or throws if invalid
    // LLSD.MAX_INTEGER // maximum 32-bit two's complement value
    // LLSD.MIN_INTEGER // minimum 32-bit two's complement value
    // LLSD.isNegativeZero(n) // true if n is negative zero
    // LLSD.isInt32(n) // true if n can be represented as an LLSD integer
    // LLSD.type(v) // one of 'undefined', 'string', 'boolean', 'integer',
    //                        'real', 'date', 'uri', 'uuid', 'binary',
    //                        'array', 'map'
    // LLSD.parseFloat(str) // following Appendix A of spec
    // LLSD.formatFloat(val) // following Appendix A of spec
    //

    const LLSD = {};

    // Parse ISO 8601 dates into ECMAScript Date objects
    //
    // Matches "YY-MM-DDThh:mm:ssZ" or "YY-MM-DDThh:mm:ss.fffZ".
    // Throws an error if the string doesn't match.
    LLSD.parseISODate = function (str)
    {
        var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(str);
        if (m)
        {
            return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
        }
        else
        {
            throw new Error('Invalid UUID string format');
        }
    };

    LLSD.MIN_INTEGER = -2147483648;
    LLSD.MAX_INTEGER = 2147483647;

    LLSD.isNegativeZero = function (a)
    {
        return (a === 0) && ((1 / a) === -Infinity);
    };

    LLSD.isInt32 = function (a)
    {
        /*jslint bitwise: false*/
        return (a >> 0) === a;
    };

    LLSD.parseFloat = function (str)
    {

        switch (str)
        {
            case '-Infinity':
                return -Infinity;
            case '-Zero':
                return -0.0;
            case '0.0':
                return 0.0;
            case '+Zero':
                return 0.0;
            case 'Infinity': // *TODO: not in the spec; should it be?
            case '+Infinity':
                return Infinity;
            case 'NaNS':
                return NaN;
            case 'NaNQ':
                return NaN;
            default:
                // *TODO: Update when the incorrect ABNF in Appendix A ABNF is corrected
                //if (/^(([1-9][0-9]*(\.[0-9]*)?)|(0\.0*[1-9][0-9]*))E(0|-?[1-9][0-9]*)$/.test(str)) {
                if (/^[\-+]?([0-9]*\.?[0-9]+)([eE][\-+]?[0-9]+)?$/.test(str))
                {
                    return parseFloat(str);
                }
                break;
        }

        // otherwise no return value (undefined)
    };

    LLSD.formatFloat = function (f)
    {
        if (isNaN(f))
        {
            return 'NaNS';
        }
        else if (f === Infinity)
        {
            return '+Infinity';
        }
        else if (f === -Infinity)
        {
            return '-Infinity';
        }
        //else if (f === 0 && 1 / f === Infinity) {
        //    return '+Zero'; // *TODO: Per spec, but is this desired?
        //}
        else if (LLSD.isNegativeZero(f))
        {
            return '-Zero'; //return '-0.0'; // *TODO: Per spec, '-Zero', but is this desired?
        }
        else
        {
            return String(f);
        }
    };

    // Return the LLSD type for a value; one of:
    //     'undefined', 'string', 'boolean', 'integer', 'real',
    //     'date', 'uri', 'uuid', 'binary', 'array', 'map'
    //
    LLSD.type = function (value)
    {

        switch (typeof value)
        {

            case 'boolean':
                return 'boolean';

            case 'number':
                return LLSD.isInt32(value) && !LLSD.isNegativeZero(value) ? 'integer' : 'real';

            case 'string':
                return 'string';

            case 'object':
                if (value === null)
                {
                    return 'undefined';
                }
                if (value instanceof UUID)
                {
                    return 'uuid';
                }
                if (value instanceof Date)
                {
                    return 'date';
                }
                if (value instanceof URI)
                {
                    return 'uri';
                }
                if (value instanceof Binary)
                {
                    return 'binary';
                }
                if (value instanceof Array)
                {
                    return 'array';
                }
                return 'map';

            case 'undefined':
                return 'undefined';

            default:
                return 'undefined';
        }
    };

    ////////////////////////////////////////////////////////////
    //
    // Parsers/Formatters
    //
    ////////////////////////////////////////////////////////////

    // Parses an XML serialization of LLSD into the corresponding
    // ECMAScript object data structure.
    //
    LLSD.parseXML = function (xmltext)
    {
        var xmldoc;

        xmldoc = (new DOMParser()).parseFromString(xmltext, "text/xml");

        if (xmldoc.documentElement.nodeName !== 'llsd')
        {
            throw new Error("Expected <llsd> as root element");
        }
        if (xmldoc.documentElement.childNodes.length !== 1)
        {
            throw new Error("Expected one child of root element");
        }

        function processElement(elem)
        {

            function nodeText(node)
            {
                var NODE_TEXT = 3,
                    child;

                if (!node.hasChildNodes())
                {
                    return '';
                }
                if (node.childNodes.length > 1)
                {
                    throw new Error("Expected single child of: " + node.nodeName);
                }
                child = node.firstChild;
                if (child.nodeType !== NODE_TEXT)
                {
                    throw new Error("Expected text node child of: " + node.nodeName);
                }

                return child.data;
            }

            var child, map, key, encoding, array;

            switch (elem.nodeName)
            {
                case "undef":
                    return null;
                case "boolean":
                    return LLSD.asBoolean(nodeText(elem));
                case "integer":
                    return LLSD.asInteger(nodeText(elem));
                case "real":
                    return LLSD.asReal(nodeText(elem));
                case "uuid":
                    // return new UUID(nodeText(elem)); // If invalid should raise error
                    return LLSD.asUUID(nodeText(elem)); // If invalid should yield default
                case "string":
                    return nodeText(elem);
                case "date":
                    // return LLSD.parseISODate(text); // If invalid should raise error
                    return LLSD.asDate(nodeText(elem)); // If invalid should yield default
                case "uri":
                    // return new URI(nodeText(elem)); // If invalid should raise error
                    return LLSD.asURI(nodeText(elem)); // If invalid should yield default
                case "binary":
                    encoding = elem.getAttribute('encoding');
                    if (encoding && encoding !== 'base64')
                    {
                        throw new Error("Unexpected encoding on <binary>: " + encoding);
                    }
                    // return new Binary(nodeText(elem)); // If invalid should raise error
                    return LLSD.asBinary(nodeText(elem)); // If invalid should yield default
                case "map":
                    map = {};
                    for (child = elem.firstChild; child; child = child.nextSibling)
                    {
                        if (child.nodeName !== 'key')
                        {
                            throw new Error("Expected <key> as child of <map>");
                        }
                        key   = nodeText(child);
                        child = child.nextSibling;
                        if (!child)
                        {
                            throw new Error("Missing sibling of <key> in <map>");
                        }

                        map[key] = processElement(child);
                    }
                    return map;

                case "array":
                    array = [];
                    for (child = elem.firstChild; child; child = child.nextSibling)
                    {
                        array.push(processElement(child));
                    }
                    return array;

                default:
                    throw new Error("Unexpected element: " + elem.nodeName);
            }
        }

        return processElement(xmldoc.documentElement.firstChild);
    };

    LLSD.formatXML = function (data)
    {

        // *TODO: Cross browser XML DOM generation

        var xml = [];

        function writeValue(datum)
        {
            function xmlEscape(string)
            {
                return string.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            }

            var i, key, keys;

            switch (LLSD.type(datum))
            {

                case 'undefined':
                    xml.push("<undef/>");
                    break;

                case 'boolean':
                    xml.push("<boolean>", LLSD.asString(datum), "</boolean>");
                    break;

                case 'integer':
                    xml.push("<integer>", LLSD.asString(datum), "</integer>");
                    break;

                case 'real':
                    xml.push("<real>", LLSD.asString(datum), "</real>");
                    break;

                case 'string':
                    xml.push("<string>", xmlEscape(datum), "</string>");
                    break;

                case 'uuid':
                    xml.push("<uuid>", LLSD.asString(datum), "</uuid>");
                    break;

                case 'date':
                    xml.push("<date>", LLSD.asString(datum), "</date>");
                    break;

                case 'uri':
                    xml.push("<uri>", LLSD.asString(datum), "</uri>");
                    break;

                case 'binary':
                    xml.push("<binary>", LLSD.asString(datum), "</binary>");
                    break;

                case 'array':
                    xml.push("<array>");
                    for (i = 0; i < datum.length; i += 1)
                    {
                        writeValue(datum[i]);
                    }
                    xml.push("</array>");
                    break;

                case 'map':
                    xml.push("<map>");
                    keys = Object.keys(datum);
                    for (i = 0; i < keys.length; i += 1)
                    {
                        key = keys[i];
                        xml.push("<key>", xmlEscape(key), "</key>");
                        writeValue(datum[key]);
                    }
                    xml.push("</map>");
                    break;
            }
        }

        xml.push("<llsd>");
        writeValue(data);
        xml.push("</llsd>");
        return xml.join("");
    };

    LLSD.OCTET_UNDEFINED     = '!'.charCodeAt(0);
    LLSD.OCTET_BOOLEAN_TRUE  = '1'.charCodeAt(0);
    LLSD.OCTET_BOOLEAN_FALSE = '0'.charCodeAt(0);
    LLSD.OCTET_INTEGER       = 'i'.charCodeAt(0);
    LLSD.OCTET_REAL          = 'r'.charCodeAt(0);
    LLSD.OCTET_STRING        = 's'.charCodeAt(0);
    LLSD.OCTET_UUID          = 'u'.charCodeAt(0);
    LLSD.OCTET_DATE          = 'd'.charCodeAt(0);
    LLSD.OCTET_URI           = 'l'.charCodeAt(0);
    LLSD.OCTET_BINARY        = 'b'.charCodeAt(0);
    LLSD.OCTET_ARRAY         = '['.charCodeAt(0);
    LLSD.OCTET_ARRAY_CLOSE   = ']'.charCodeAt(0);
    LLSD.OCTET_MAP           = '{'.charCodeAt(0);
    LLSD.OCTET_MAP_KEY       = 'k'.charCodeAt(0);
    LLSD.OCTET_MAP_CLOSE     = '}'.charCodeAt(0);

    // Parses a Binary serialization of LLSD into the corresponding
    // ECMAScript object data structure.
    //
    LLSD.parseBinary = function (binary)
    {

        if (typeof binary === 'string')
        {
            binary = new Binary(binary, 'BASE64');
        }
        else if (binary instanceof Array)
        {
            binary = new Binary(binary);
        }

        var octets = binary.toArray(),
            offset = 0,
            value;

        function eod()
        {
            return offset >= octets.length;
        }

        function read(n)
        {
            if (offset + n > octets.length)
            {
                throw new Error("Unexpected end of data");
            }
            var result = octets.slice(offset, offset + n);
            offset += n;
            return result;
        }

        function readOctet()
        {
            return read(1)[0];
        }

        function readU32()
        {
            var u8array = new Uint8Array(read(4)),
                dv      = new DataView(u8array.buffer);

            return dv.getUint32(0);
        }

        function readS32()
        {
            var u8array = new Uint8Array(read(4)),
                dv      = new DataView(u8array.buffer);

            return dv.getInt32(0);
        }

        function readF64()
        {
            var u8array = new Uint8Array(read(8)),
                dv      = new DataView(u8array.buffer);

            return dv.getFloat64(0);
        }

        function readString()
        {
            var len = readU32();
            return new Binary(read(len)).toString('UTF-8');
        }

        function readUUID()
        {
            return new UUID(read(16));
        }

        function readValue()
        {
            if (eod())
            {
                throw new Error("Unexpected end of data");
            }

            var octet = readOctet(),
                i, len, array, map, key;
            switch (octet)
            {
                case LLSD.OCTET_UNDEFINED:
                    return null;

                case LLSD.OCTET_BOOLEAN_FALSE:
                    return false;

                case LLSD.OCTET_BOOLEAN_TRUE:
                    return true;

                case LLSD.OCTET_INTEGER:
                    return readS32();

                case LLSD.OCTET_REAL:
                    return readF64();

                case LLSD.OCTET_STRING:
                    return readString();

                case LLSD.OCTET_UUID:
                    return readUUID();

                case LLSD.OCTET_DATE:
                    return new Date(readF64() * 1000);

                case LLSD.OCTET_URI:
                    return new URI(readString());

                case LLSD.OCTET_BINARY:
                    len = readU32();
                    return new Binary(read(len));

                case LLSD.OCTET_ARRAY:
                    len   = readU32();
                    array = [];
                    for (i = 0; i < len; i += 1)
                    {
                        array.push(readValue());
                    }
                    if (readOctet() !== LLSD.OCTET_ARRAY_CLOSE)
                    {
                        throw new Error("Expected array close tag");
                    }
                    return array;

                case LLSD.OCTET_MAP:
                    len = readU32();

                    map = {};
                    for (i = 0; i < len; i += 1)
                    {
                        if (readOctet() !== LLSD.OCTET_MAP_KEY)
                        {
                            throw new Error("Expected map key tag");
                        }
                        key      = readString();
                        map[key] = readValue();
                    }
                    if (readOctet() !== LLSD.OCTET_MAP_CLOSE)
                    {
                        throw new Error("Expected map close tag");
                    }
                    return map;

                default:
                    throw new Error("Unexpected tag");
            }
        }

        value = readValue();
        if (!eod())
        {
            throw new Error("Unexpected continuation of binary data");
        }

        return value;
    };

    LLSD.formatBinary = function (data)
    {
        var octets = [];

        function write(array)
        {
            var i;
            if (array instanceof DataView)
            {
                for (i = 0; i < array.byteLength; i += 1)
                {
                    octets.push(array.getUint8(i));
                }
            }
            else
            {
                for (i = 0; i < array.length; i += 1)
                {
                    octets.push(array[i]);
                }
            }
        }

        function writeOctet(octet)
        {
            write([octet]);
        }

        function writeU32(u32)
        {
            var dv = new DataView(new ArrayBuffer(4));
            dv.setUint32(0, u32);
            write(dv);
        }

        function writeS32(s32)
        {
            var dv = new DataView(new ArrayBuffer(4));
            dv.setInt32(0, s32);
            write(dv);
        }

        function writeF64(f64)
        {
            var dv = new DataView(new ArrayBuffer(8));
            dv.setFloat64(0, f64);
            write(dv);
        }

        function writeString(string)
        {
            var bytes = new Binary(string, 'UTF-8').toArray();
            writeU32(bytes.length);
            write(bytes);
        }

        function writeValue(datum)
        {
            var len, i, bytes, keys, key;

            switch (LLSD.type(datum))
            {

                case 'undefined':
                    writeOctet(LLSD.OCTET_UNDEFINED);
                    break;

                case 'boolean':
                    writeOctet(datum ? LLSD.OCTET_BOOLEAN_TRUE : LLSD.OCTET_BOOLEAN_FALSE);
                    break;

                case 'integer':
                    writeOctet(LLSD.OCTET_INTEGER);
                    writeS32(datum);
                    break;

                case 'real':
                    writeOctet(LLSD.OCTET_REAL);
                    writeF64(datum);
                    break;

                case 'string':
                    writeOctet(LLSD.OCTET_STRING);
                    writeString(datum);
                    break;

                case 'uuid':
                    writeOctet(LLSD.OCTET_UUID);
                    write(datum.getOctets());
                    break;

                case 'date':
                    writeOctet(LLSD.OCTET_DATE);
                    writeF64(Number(datum) / 1000);
                    break;

                case 'uri':
                    writeOctet(LLSD.OCTET_URI);
                    writeString(String(datum));
                    break;

                case 'binary':
                    writeOctet(LLSD.OCTET_BINARY);
                    bytes = datum.toArray();
                    writeU32(bytes.length);
                    write(bytes);
                    break;

                case 'array':
                    writeOctet(LLSD.OCTET_ARRAY);
                    len = datum.length;
                    writeU32(len);
                    for (i = 0; i < len; i += 1)
                    {
                        writeValue(datum[i]);
                    }
                    writeOctet(LLSD.OCTET_ARRAY_CLOSE);
                    break;

                case 'map':
                    keys = Object.keys(datum);

                    writeOctet(LLSD.OCTET_MAP);
                    len = keys.length;
                    writeU32(len);
                    for (i = 0; i < len; i += 1)
                    {
                        key = keys[i];
                        writeOctet(LLSD.OCTET_MAP_KEY);
                        writeString(key);
                        writeValue(datum[key]);
                    }
                    writeOctet(LLSD.OCTET_MAP_CLOSE);
                    break;
            }
        }

        writeValue(data);

        return new Binary(octets);
    };

    if (LL_LEGACY)
    {
        LLSD.parseNotation = function (string)
        {
            // http://wiki.secondlife.com/wiki/LLSD#Notation_Serialization

            function error(errmsg)
            {
                throw new Error(errmsg);
            }

            function test(regex)
            {
                if (!(regex instanceof RegExp))
                {
                    regex = new RegExp('^' + regex);
                }
                var m = regex.exec(string);
                if (m)
                {
                    string = string.substring(m[0].length);
                    return m.length > 1 ? m[1] : m[0];
                }
                // return undefined
            }

            function req(regex, errmsg)
            {
                var t = test(regex);
                if (t)
                {
                    return t;
                }
                error(errmsg);
            }

            function ws()
            {
                test(/^\s+/);
            }

            var re_real = /^([\-+]?([0-9]*\.?[0-9]+)([eE][\-+]?[0-9]+)?|[\-+]?Infinity|NaN)/,
                re_uuid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/,
                re_date = /^((\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z)/,
                value;

            function parseValue()
            {
                /*jslint regexp: false*/
                var res, key;

                ws();
                if (!string.length)
                {
                    error('unexpected end-of-string');
                }
                if (test('!'))
                {
                    return null;
                }
                if (test('(1|true|TRUE|t|T)'))
                {
                    return true;
                }
                if (test('(0|false|FALSE|f|F)'))
                {
                    return false;
                }
                if (test('i'))
                {
                    return parseInt(req('[-+]?[0-9]+', 'expected integer'), 10);
                }
                if (test('r'))
                {
                    return parseFloat(req(re_real, 'expected real'));
                }
                if (test('u'))
                {
                    return new UUID(req(re_uuid, 'expected uuid'));
                }
                if (test('b'))
                {
                    res = test('\\(([0-9]+)\\)');
                    if (res)
                    {
                        res = parseInt(res, 10);
                        res = req('"([\\s|\\S]{' + res + '})"', 'expected binary data');
                        return new Binary(res, 'BINARY');
                    }

                    if (test('16'))
                    {
                        res = req('"([^"]*)"', 'expected binary data');
                        return new Binary(res, 'BASE16');
                    }

                    if (test('64'))
                    {
                        res = req('"([^"]*)"', 'expected binary data');
                        return new Binary(res, 'BASE64');
                    }
                    error('unexpected binary base');
                }
                if (test('s'))
                {
                    res = parseInt(req('\\(([0-9]+)\\)', 'expected length'), 10);
                    return req('"([\\s\\S]{' + res + '})"', 'expected string');
                }
                if (test('"'))
                {
                    res = req(/^(([^\"\\]|\\[\s\S])*)\"/, 'expected string');
                    return res.replace(/\\([\s\S])/g, '$1');
                }
                if (test("'"))
                {
                    res = req(/^(([^\'\\]|\\[\s\S])*)\'/, 'expected string');
                    return res.replace(/\\([\s\S])/g, '$1');
                }
                if (test('l'))
                {
                    return new URI(req('"([^"]*)"', 'expected uri'));
                }
                if (test('d'))
                {
                    req('"', 'expected quote');
                    res = req(re_date, 'expected date');
                    req('"', 'expected quote');
                    return LLSD.parseISODate(res);
                }
                if (test('\\['))
                {
                    res = [];
                    ws();
                    if (test('\\]'))
                    {
                        return res;
                    }
                    while (true)
                    {
                        res.push(parseValue());
                        ws();
                        if (!test(','))
                        {
                            break;
                        }
                        ws();
                    }
                    req('\\]', 'expected value or close bracket');
                    return res;
                }
                if (test('{'))
                {
                    res = {};
                    ws();
                    if (test('}'))
                    {
                        return res;
                    }
                    while (true)
                    {
                        key = parseValue();
                        if (typeof key !== 'string')
                        {
                            error('expected string');
                        }
                        ws();
                        req(':', 'expected colon');
                        ws();
                        res[key] = parseValue();
                        ws();
                        if (!test(','))
                        {
                            break;
                        }
                        ws();
                    }
                    req('}', 'expected key or close brace');
                    return res;
                }
                error('unexpected token: ' + string.charAt(0));
            }

            value = parseValue();
            ws();
            if (string.length)
            {
                error('expected end-of-string, saw: ' + string);
            }
            return value;
        };

        LLSD.formatNotation = function (data)
        {
            var out = [];

            function writeString(value)
            {
                out.push('"', value.replace(/[\\]/g, "\\\\").replace(/[\"]/g, "\\\""), "\"");
            }

            function writeValue(value)
            {
                var i, key, keys;
                switch (LLSD.type(value))
                {
                    case 'undefined':
                        out.push('!');
                        break;
                    case 'boolean':
                        out.push(value ? '1' : '0');
                        break;
                    case 'integer':
                        out.push('i', String(value));
                        break;
                    case 'real':
                        out.push('r', String(value));
                        break;
                    case 'string':
                        writeString(value);
                        break;
                    case 'uuid':
                        out.push('u', LLSD.asString(value));
                        break;
                    case 'date':
                        out.push('d"', LLSD.asString(value), '"');
                        break;
                    case 'uri':
                        out.push('l"', LLSD.asString(value), '"');
                        break;
                    case 'binary':
                        out.push('b64"', LLSD.asString(value), '"');
                        break;
                    case 'array':
                        out.push('[');
                        for (i = 0; i < value.length; i += 1)
                        {
                            if (i !== 0)
                            {
                                out.push(',');
                            }
                            writeValue(value[i]);
                        }
                        out.push(']');
                        break;

                    case 'map':
                        out.push('{');
                        keys = Object.keys(value);
                        for (i = 0; i < keys.length; i += 1)
                        {
                            if (i !== 0)
                            {
                                out.push(',');
                            }
                            key = keys[i];
                            writeString(key);
                            out.push(':');
                            writeValue(value[key]);
                        }
                        out.push('}');
                        break;
                }
            }

            writeValue(data);
            return out.join('');
        };
    }

    LLSD.parseJSON = function (text)
    {
        if (JSON && JSON.parse && typeof JSON.parse === 'function')
        {
            return JSON.parse(text);
        }
        else
        {
            throw new Error("Use a local copy of json2.js from json.org for JSON serialization");
        }
    };

    LLSD.formatJSON = function (data)
    {
        if (JSON && JSON.stringify && typeof JSON.stringify === 'function')
        {
            return JSON.stringify(data, function (k, v)
            {
                // JSON does not support +/-Infinity or NaN or distinguish -0; format as strings
                if (typeof v === 'number' && (!isFinite(v) || LLSD.isNegativeZero(v)))
                {
                    return LLSD.formatFloat(v);
                }
                return v;
            });
        }
        else
        {
            throw new Error("Use a local copy of json2.js from json.org for JSON serialization");
        }
    };

    LLSD.MIMETYPE_XML    = "application/llsd+xml";
    LLSD.MIMETYPE_JSON   = "application/llsd+json";
    LLSD.MIMETYPE_BINARY = "application/llsd+binary";

    LLSD.parse = function (contentType, input)
    {
        switch (contentType)
        {
            case LLSD.MIMETYPE_XML:
                return LLSD.parseXML(input);

            case LLSD.MIMETYPE_JSON:
                return LLSD.parseJSON(input);

            case LLSD.MIMETYPE_BINARY:
                return LLSD.parseBinary(input);

            default:
                throw new Error("Unsupported content-type: " + contentType);
        }
    };

    LLSD.format = function (contentType, data)
    {
        switch (contentType)
        {
            case LLSD.MIMETYPE_XML:
                return LLSD.formatXML(data);

            case LLSD.MIMETYPE_JSON:
                return LLSD.formatJSON(data);

            case LLSD.MIMETYPE_BINARY:
                return LLSD.formatBinary(data);

            default:
                throw new Error("Unsupported content-type: " + contentType);
        }
    };

    ////////////////////////////////////////////////////////////
    //
    // Conversions
    //
    ////////////////////////////////////////////////////////////

    LLSD.asUndefined = function (value)
    {
        return null;
    };

    LLSD.asBoolean = function (value)
    {
        switch (LLSD.type(value))
        {
            case 'boolean':
                return value;
            case 'integer':
                return value !== 0;
            case 'real':
                return value !== 0 && !isNaN(value);
            case 'string':
                return value.length > 0;
            default:
                return false;
        }
    };

    LLSD.asInteger = function (value)
    {
        switch (LLSD.type(value))
        {
            case 'boolean':
                return value ? 1 : 0;
            case 'integer':
                return value;
            case 'string':
                value = LLSD.parseFloat(value);
                break;

            case 'real':
                break;
            default:
                return 0;
        }

        value = isNaN(value) ? 0 : Math.round(value);

        if (value > LLSD.MAX_INTEGER)
        {
            return LLSD.MAX_INTEGER;
        }
        else if (value < LLSD.MIN_INTEGER)
        {
            return LLSD.MIN_INTEGER;
        }
        else
        {
            return value;
        }
    };

    LLSD.asReal = function (value)
    {
        switch (LLSD.type(value))
        {
            case 'integer':
                return value;
            case 'real':
                return value;
            case 'string':
                return LLSD.parseFloat(value);
            case 'boolean':
                return value ? 1.0 : 0.0;
            default:
                return 0.0;
        }
    };

    LLSD.asString = function (value)
    {
        switch (LLSD.type(value))
        {
            case 'string':
                return value;
            case 'boolean':
                return value ? 'true' : '';
            case 'integer':
                return String(value);
            case 'real':
                return LLSD.formatFloat(value);
            case 'uuid':
                return String(value);
            case 'date':
                return value.toJSON();
            case 'uri':
                return String(value);
            case 'binary':
                return value.toString('BASE64');
            default:
                return '';
        }
    };

    LLSD.asUUID = function (value)
    {
        switch (LLSD.type(value))
        {
            case 'uuid':
                return value;
            case 'string':
                try
                {
                    return new UUID(value);
                }
                catch (e)
                {
                }
                break;
        }
        return new UUID();
    };

    LLSD.asDate = function (value)
    {
        switch (LLSD.type(value))
        {
            case 'date':
                return value;
            case 'string':
                try
                {
                    return LLSD.parseISODate(value);
                }
                catch (e)
                {
                }
                break;
        }
        return new Date(0);
    };

    LLSD.asURI = function (value)
    {
        switch (LLSD.type(value))
        {
            case 'uri':
                return value;
            case 'string':
                try
                {
                    return new URI(value);
                }
                catch (e)
                {
                }
                break;
        }
        return new URI();
    };

    LLSD.asBinary = function (value)
    {
        switch (LLSD.type(value))
        {
            case 'binary':
                return value;
            case 'string':
                try
                {
                    return new Binary(value, 'BASE64');
                }
                catch (e)
                {
                }
                break;
        }
        return new Binary();
    };

    const LLIDLException     = function (message)
    {
        this.name    = 'LLIDLException';
        this.message = message;
    };
    LLIDLException.prototype = new Error();

    const LLIDL = {};

    ////////////////////////////////////////////////////////////
    //
    // Utilities
    //
    ////////////////////////////////////////////////////////////

    // Pass-through function to throw exception if something is awry
    function required(o, e)
    {
        if (!o)
        {
            throw new LLIDLException(e);
        }
        return o;
    }

    ////////////////////////////////////////////////////////////
    //
    // Constants
    //
    ////////////////////////////////////////////////////////////

    var MATCHED      = 4,
        CONVERTED    = 3,
        DEFAULTED    = 2.2,
        ADDITIONAL   = 2.1,
        MIXED        = 1,
        INCOMPATIBLE = 0;

    ////////////////////////////////////////////////////////////
    //
    // Parser
    //
    ////////////////////////////////////////////////////////////

    function Parser(s)
    {
        this.string = s;
    }

    Parser.prototype.eof = function ()
    {
        return (this.string.length === 0);
    };

    Parser.prototype.match = function ()
    {
        var i, opt;
        for (i = 0; i < arguments.length; i += 1)
        {
            opt = arguments[i];
            if (this.string.length >= opt.length && this.string.substring(0, opt.length) === opt)
            {
                this.string = this.string.substring(opt.length);
                return opt;
            }
        }
        return false;
    };

    Parser.prototype.matchRegex = function (pattern)
    {
        var re = new RegExp("^" + pattern),
            m  = this.string.match(re);
        if (m)
        {
            this.string = this.string.substring(m[0].length);
            return m[0];
        }
        return false;
    };

    ////////////////////////////////////////////////////////////
    //
    // Terminals
    //
    ////////////////////////////////////////////////////////////

    // newline         = lf / cr / (cr lf)
    Parser.prototype.parse_newline = function ()
    {
        return this.match('\r\n', '\r', '\n');
    };

    // comment         = ";" *char newline
    Parser.prototype.parse_comment = function ()
    {
        if (!this.match(';'))
        {
            return;
        }
        var comment = "", c;
        while (true)
        {
            // ECMAScript strings are UTF-16; to match U+10000-U+10FFFF
            // need to match the UTF-16 surrogate pair encoding
            c = this.matchRegex("[\\u0009\\u0020-\\uD7FF\\uE000-\\uFFFD]|[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]");
            if (!c)
            {
                break;
            }
            comment += c;
        }
        required(this.parse_newline(), "expected newline");
        return comment;
    };

    // s               = *( tab / newline / sp / comment )
    Parser.prototype.parse_s = function ()
    {
        var s = "", c;
        while (!this.eof())
        {
            c = this.match('\t') ||
                this.parse_newline() ||
                this.match(' ') ||
                this.parse_comment();

            if (c)
            {
                s += c;
            }
            else
            {
                break;
            }
        }
        return s;
    };

    // name            = name_start *name_continue
    // name_start      = id_start    / "_"
    // name_continue   = id_continue / "_" / "/"
    // id_start        = %x0041-005A / %x0061-007A ; ALPHA
    // id_continue     = id_start / %x0030-0039    ; DIGIT
    Parser.prototype.parse_name = function ()
    {
        return this.matchRegex("[A-Za-z_][A-Za-z0-9_/]*");
    };

    ////////////////////////////////////////////////////////////
    //
    // LLIDL Value Types
    //
    ////////////////////////////////////////////////////////////

    //
    // The following block contains:
    //
    // * Parser methods forming a recursive descent parser
    //   for LLIDL. These are roughly of the form:
    //     var res = parser.parse_<TypeName>()
    //   Returns a <TypeName>Matcher object
    //
    // * Class definitions for various types, which expose:
    //     <TypeName>Matcher.compare(data, variantdefs)
    //   This recursively validates the data against the
    //   IDL specification. (VariantMatcher definitions are
    //   necessary as LLIDL may specify named variants.)
    //

    // value           =  type / array / map / selector / variant
    function ValueMatcher()
    {
    }

    ValueMatcher.prototype.valid          = function (value, variants)
    {
        return this.compare(value, variants) > INCOMPATIBLE;
    };
    ValueMatcher.prototype.match          = function (value, variants)
    {
        return this.compare(value, variants) > ADDITIONAL;
    };
    ValueMatcher.prototype.has_additional = function (value, variants)
    {
        var result = this.compare(value, variants);
        return MIXED <= result && result <= ADDITIONAL;
    };
    ValueMatcher.prototype.incompatible   = function (value, variants)
    {
        return this.compare(value, variants) === INCOMPATIBLE;
    };

    Parser.prototype.parse_value = function ()
    {
        var v;
        v = this.parse_type();
        if (v)
        {
            return v;
        }
        v = this.parse_array();
        if (v)
        {
            return v;
        }
        v = this.parse_map();
        if (v)
        {
            return v;
        }
        v = this.parse_selector();
        if (v)
        {
            return v;
        }
        v = this.parse_variant();
        if (v)
        {
            return v;
        }

        return false;
    };

    // type            =  "undef"
    // type            =/ "string"
    // type            =/ "bool"
    // type            =/ "int"
    // type            =/ "real"
    // type            =/ "date"
    // type            =/ "uri"
    // type            =/ "uuid"
    // type            =/ "binary"
    function TypeMatcher(t)
    {
        this.t = t;
    }

    TypeMatcher.prototype          = new ValueMatcher();
    TypeMatcher.prototype.toString = function ()
    {
        return "[type: " + this.t + "]";
    };
    Parser.prototype.parse_type    = function ()
    {
        var m = this.match("undef", "string", "bool", "int", "real", "date", "uri", "uuid", "binary");
        if (m)
        {
            return new TypeMatcher(m);
        }
        return false;
    };
    TypeMatcher.prototype.compare  = function (value, variants)
    {
        switch (this.t)
        {
            case "undef":
                return MATCHED;

            case "string":
                switch (LLSD.type(value))
                {
                    case 'undefined':
                        return DEFAULTED;
                    case 'boolean':
                        return CONVERTED;
                    case 'integer':
                        return CONVERTED;
                    case 'real':
                        return CONVERTED;
                    case 'string':
                        return MATCHED;
                    case 'date':
                        return CONVERTED;
                    case 'uri':
                        return CONVERTED;
                    case 'uuid':
                        return CONVERTED;
                    case 'binary':
                        return CONVERTED;
                }
                return INCOMPATIBLE;

            case "bool":
                switch (LLSD.type(value))
                {
                    case 'undefined':
                        return DEFAULTED;
                    case 'boolean':
                        return MATCHED;
                    case 'integer':
                        return value === 0 || value === 1 ? CONVERTED : INCOMPATIBLE;
                    case 'real':
                        return value === 0.0 || value === 1.0 ? CONVERTED : INCOMPATIBLE;
                    case 'string':
                        return value === "" || value === "true" ? CONVERTED : INCOMPATIBLE;
                }
                return INCOMPATIBLE;

            case "int":
                switch (LLSD.type(value))
                {
                    case 'undefined':
                        return DEFAULTED;
                    case 'boolean':
                        return CONVERTED;
                    case 'integer':
                        return MATCHED;
                    case 'real':
                        return LLSD.asInteger(value) === value ? CONVERTED : INCOMPATIBLE;
                    case 'string':
                        if (value === "")
                        {
                            return DEFAULTED;
                        }
                        value = LLSD.parseFloat(value);
                        return LLSD.asInteger(value) === value ? CONVERTED : INCOMPATIBLE;
                }
                return INCOMPATIBLE;

            case "real":
                switch (LLSD.type(value))
                {
                    case 'undefined':
                        return DEFAULTED;
                    case 'boolean':
                        return CONVERTED;
                    case 'integer':
                        return CONVERTED;
                    case 'real':
                        return MATCHED;
                    case 'string':
                        return value === "" ? DEFAULTED : typeof LLSD.parseFloat(value) === 'number' ? CONVERTED : INCOMPATIBLE;
                }
                return INCOMPATIBLE;

            case "date":
                switch (LLSD.type(value))
                {
                    case 'undefined':
                        return DEFAULTED;
                    case 'string':
                        try
                        {
                            return value === "" ? DEFAULTED : LLSD.parseISODate(value) ? CONVERTED : INCOMPATIBLE;
                        }
                        catch (e1)
                        {
                        }
                        return INCOMPATIBLE;
                    case 'date':
                        return MATCHED;
                }
                return INCOMPATIBLE;

            case "uri":
                switch (LLSD.type(value))
                {
                    case 'undefined':
                        return DEFAULTED;
                    case 'string':
                        try
                        {
                            return value === "" ? DEFAULTED : new URI(value) ? CONVERTED : INCOMPATIBLE;
                        }
                        catch (e2)
                        {
                        }
                        return INCOMPATIBLE;
                    case 'uri':
                        return MATCHED;
                }
                return INCOMPATIBLE;

            case "uuid":
                switch (LLSD.type(value))
                {
                    case 'undefined':
                        return DEFAULTED;
                    case 'string':
                        try
                        {
                            return value === "" ? DEFAULTED : new UUID(value) ? CONVERTED : INCOMPATIBLE;
                        }
                        catch (e3)
                        {
                        }
                        return INCOMPATIBLE;
                    case 'uuid':
                        return MATCHED;
                }
                return INCOMPATIBLE;

            case "binary":
                switch (LLSD.type(value))
                {
                    case 'undefined':
                        return DEFAULTED;
                    case 'string':
                        try
                        {
                            return new Binary(value, 'BASE64') ? CONVERTED : INCOMPATIBLE;
                        }
                        catch (e4)
                        {
                        }
                        return INCOMPATIBLE;
                    case 'binary':
                        return MATCHED;
                }
                return INCOMPATIBLE;
        }
    };

    // array           =  "[" s value-list s "]"
    // array           =/ "[" s value-list s "..." s "]"
    // value-list      = value [ s "," [ s value-list ] ]
    function ArrayMatcher()
    {
        this.list    = [];
        this.repeats = false;
    }

    ArrayMatcher.prototype          = new ValueMatcher();
    ArrayMatcher.prototype.toString = function ()
    {
        return "[array: " + this.list.join(", ") + (this.repeats ? "..." : "") + "]";
    };
    Parser.prototype.parse_array    = function ()
    {
        var a, value;

        if (!this.match("["))
        {
            return false;
        }
        a = new ArrayMatcher();
        this.parse_s(); // s

        // value-list
        value = required(this.parse_value(), "empty array");

        while (true)
        { // [ s "," [ s value-list ] ]
            a.list.push(value);
            this.parse_s();
            if (!this.match(","))
            {
                break;
            }

            this.parse_s();
            value = this.parse_value();
            if (!value)
            {
                break;
            }
        }

        this.parse_s();

        if (this.match("..."))
        {
            a.repeats = true;
        }

        this.parse_s();

        required(this.match("]"), "expected close bracket");

        return a;
    };
    ArrayMatcher.prototype.compare  = function (value, variants)
    {

        if (LLSD.type(value) === 'undefined')
        {
            value = [];
        }

        // See if required types are present
        if (LLSD.type(value) !== 'array')
        {
            return INCOMPATIBLE;
        }

        var result = MATCHED,
            max    = Math.max(value.length, this.list.length),
            i, j;

        for (i = 0; i < max; i += 1)
        {
            if (!this.repeats && i >= this.list.length)
            {
                // more than permitted members
                result = Math.min(ADDITIONAL, result);
                break;
            }
            else
            {

                j = i % this.list.length; // offset within LLIDL list
                if (i >= value.length)
                {
                    result = Math.min(this.list[j].compare(null), result);
                }
                else
                {
                    result = Math.min(this.list[j].compare(value[i]), result);
                }
            }
        }

        return result;
    };

    // map             =  "{" s member-list s "}"
    // map             =/ "{" s "$" s ":" s value s "}"
    // member-list     = member [ s "," [ s member-list ] ]
    // member          = name s ":" s value
    function MapMatcher()
    {
        this.members = {};
    }

    MapMatcher.prototype          = new ValueMatcher();
    MapMatcher.prototype.toString = function ()
    {
        return "[map: " + this.members + "]";
    };
    Parser.prototype.parse_map    = function ()
    {
        if (!this.match("{"))
        {
            return false;
        }
        var m = new MapMatcher(),
            name, value;

        this.parse_s();

        if (this.match("$"))
        {
            this.parse_s();
            required(this.match(':'), "expected colon");
            this.parse_s();
            value       = required(this.parse_value(), "expected value");
            m.members.$ = value;
        }
        else
        {
            // member-list

            name = required(this.parse_name(), "empty map");

            while (true)
            {
                this.parse_s();
                required(this.match(':'), "expected colon");
                this.parse_s();
                value           = required(this.parse_value(), "expected value");
                m.members[name] = value;

                this.parse_s();
                if (!this.match(","))
                {
                    break;
                }
                this.parse_s();

                name = this.parse_name();
                if (!name)
                {
                    break;
                }
            }
        }

        this.parse_s();
        required(this.match("}"), "expected close bracket");

        return m;
    };
    MapMatcher.prototype.compare  = function (value, variants)
    {

        if (LLSD.type(value) === 'undefined')
        {
            value = {};
        }

        if (LLSD.type(value) !== 'map')
        {
            return INCOMPATIBLE;
        }

        var req, val, key, name,
            result = MATCHED;

        if (this.members.$)
        {
            // { $ : value } - all map values must conform
            req = this.members.$;
            for (key in value)
            {
                if (value.hasOwnProperty(key))
                {
                    val    = value[key];
                    result = Math.min(req.compare(val, variants), result);
                }
            }
        }
        else
        {
            // Require all named members
            for (name in this.members)
            {
                if (this.members.hasOwnProperty(name))
                {

                    if (value.hasOwnProperty(name))
                    {
                        req    = this.members[name];
                        val    = value[name];
                        result = Math.min(req.compare(val, variants), result);
                    }
                    else
                    {
                        result = Math.min(DEFAULTED, result);
                    }
                }
            }
            for (name in value)
            {
                if (value.hasOwnProperty(name))
                {
                    if (!this.members.hasOwnProperty(name))
                    {
                        result = Math.min(ADDITIONAL, result);
                    }
                }
            }
        }

        return result;
    };

    // selector        =  quote name quote
    // selector        =/ "true" / "false"
    // selector        =/ 1*digit
    function SelectorMatcher(value)
    {
        this.value = value;
    }

    SelectorMatcher.prototype          = new ValueMatcher();
    SelectorMatcher.prototype.toString = function ()
    {
        return "[selector: " + this.value + "]";
    };
    Parser.prototype.parse_selector    = function ()
    {

        var s;
        if (this.match('"'))
        {
            s = required(this.parse_name(), "expected name in quotes");
            required(this.match('"'), "expected close quote");
            return new SelectorMatcher(s);
        }

        s = this.match("true", "false");
        if (s)
        {
            return new SelectorMatcher(s === "true");
        }

        s = this.matchRegex("[0-9]+");
        if (s)
        {
            return new SelectorMatcher(parseInt(s, 10));
        }

        return false;
    };
    SelectorMatcher.prototype.compare  = function (value, variants)
    {
        // See if value is an exact match
        switch (LLSD.type(this.value))
        {
            case 'string':
                switch (LLSD.type(value))
                {
                    case 'undefined':
                        return this.value === "" ? DEFAULTED : INCOMPATIBLE;
                    case 'string':
                        return this.value === value ? MATCHED : INCOMPATIBLE;
                }
                return INCOMPATIBLE;

            case 'boolean':
                switch (LLSD.type(value))
                {
                    case 'undefined':
                        return this.value ? INCOMPATIBLE : DEFAULTED;
                    case 'boolean':
                        return this.value === value ? MATCHED : INCOMPATIBLE;
                    case 'integer':
                        return (this.value ? 1 : 0) === value ? CONVERTED : INCOMPATIBLE;
                    case 'real':
                        return (this.value ? 1.0 : 0.0) === value ? CONVERTED : INCOMPATIBLE;
                    case 'string':
                        return (this.value ? "true" : "") === value ? CONVERTED : INCOMPATIBLE;
                }
                return INCOMPATIBLE;

            case 'integer':
                switch (LLSD.type(value))
                {
                    case 'undefined':
                        return this.value === 0 ? DEFAULTED : INCOMPATIBLE;
                    case 'boolean':
                        return this.value === (value ? 1 : 0) ? CONVERTED : INCOMPATIBLE;
                    case 'integer':
                        return this.value === value ? MATCHED : INCOMPATIBLE;
                    case 'real':
                        return this.value === LLSD.asInteger(value) ? CONVERTED : INCOMPATIBLE;
                    case 'string':
                        if (value === "")
                        {
                            return this.value === 0 ? DEFAULTED : INCOMPATIBLE;
                        }
                        value = LLSD.parseFloat(value);
                        return this.value === LLSD.asInteger(value) ? CONVERTED : INCOMPATIBLE;
                }
                return INCOMPATIBLE;
        }
    };

    // variant         = "&" name
    function VariantMatcher(name)
    {
        this.name = name;
    }

    VariantMatcher.prototype          = new ValueMatcher();
    VariantMatcher.prototype.toString = function ()
    {
        return "[variant: " + this.name + "]";
    };
    Parser.prototype.parse_variant    = function ()
    {
        if (!this.match("&"))
        {
            return false;
        }
        var n = required(this.parse_name(), "expected variant name");
        return new VariantMatcher(n);
    };
    VariantMatcher.prototype.compare  = function (value, variants)
    {

        var result = INCOMPATIBLE,
            i, vd;

        // loop over possible variant definitions and pick the best match
        for (i = 0; i < variants.length; i += 1)
        {
            vd = variants[i];
            if (this.name === vd.name)
            {
                result = Math.max(vd.value.compare(value, variants), result);
            }
        }

        return result;
    };

    ////////////////////////////////////////////////////////////
    //
    // LLIDL Resource Types
    //
    ////////////////////////////////////////////////////////////

    //
    // The following block contains:
    //
    // * Parser methods forming a recursive descent parser
    //   for LLIDL. These are roughly of the form:
    //     var res = parser.parse_<ResourceType>()
    //   Returns a <ResourceType> object
    //
    // * Class definitions for various types, which expose:
    //     <ResourceType>.valid_request(data, variantdefs)
    //     <ResourceType>.valid_response(data, variantdefs)
    //

    // variant-def     = "&" name s "=" s value
    function VariantDef(name, value)
    {
        this.name  = name;
        this.value = value;
    }

    VariantDef.prototype.toString     = function ()
    {
        return "[variant-def " + this.name + " = " + this.value + "]";
    };
    Parser.prototype.parse_variantdef = function ()
    {
        var name, value;

        if (!this.match("&"))
        {
            return false;
        }
        name = required(this.parse_name(), "expected variant name");
        this.parse_s();
        required(this.match("="), "expected equals sign");
        this.parse_s();
        value = required(this.parse_value(), "expected variant value");
        return new VariantDef(name, value);
    };

    // res-name        = "%%" s name
    Parser.prototype.parse_resname = function ()
    {
        if (!this.match("%%"))
        {
            return false;
        }
        this.parse_s();
        return required(this.parse_name(), "expected resource name");
    };

    // res-get         = "<<" s value
    function ResourceGet(value)
    {
        this.value = value;
    }

    ResourceGet.prototype.toString         = function ()
    {
        return "[res-get << " + this.value + "]";
    };
    Parser.prototype.parse_resget          = function ()
    {
        if (!this.match("<<"))
        {
            return false;
        }
        this.parse_s();
        var value = required(this.parse_value(), "expected value");
        return new ResourceGet(value);
    };
    ResourceGet.prototype.compare_request  = function (request, variants)
    {
        return INCOMPATIBLE;
    };
    ResourceGet.prototype.compare_response = function (response, variants)
    {
        return this.value.compare(response, variants);
    };

    // res-getput      = "<>" s value
    function ResourceGetPut(value)
    {
        this.value = value;
    }

    ResourceGetPut.prototype.toString         = function ()
    {
        return "[res-getput <> " + this.value + "]";
    };
    Parser.prototype.parse_resgetput          = function ()
    {
        if (!this.match("<>"))
        {
            return false;
        }
        this.parse_s();
        var value = required(this.parse_value(), "expected value");
        return new ResourceGetPut(value);
    };
    ResourceGetPut.prototype.compare_request  = function (request, variants)
    {
        return this.value.compare(request, variants);
    };
    ResourceGetPut.prototype.compare_response = function (response, variants)
    {
        return this.value.compare(response, variants);
    };

    // res-getputdel   = "<x>" s value
    function ResourceGetPutDel(value)
    {
        this.value = value;
    }

    ResourceGetPutDel.prototype.toString         = function ()
    {
        return "[res-getputdel <x> " + this.value + "]";
    };
    Parser.prototype.parse_resgetputdel          = function ()
    {
        if (!this.match("<x>"))
        {
            return false;
        }
        this.parse_s();
        var value = required(this.parse_value(), "expected value");
        return new ResourceGetPutDel(value);
    };
    ResourceGetPutDel.prototype.compare_request  = function (request, variants)
    {
        return this.value.compare(request, variants);
    };
    ResourceGetPutDel.prototype.compare_response = function (response, variants)
    {
        return this.value.compare(response, variants);
    };

    // res-post        = res-request s res-response
    function ResourcePost(request, response)
    {
        this.request  = request;
        this.response = response;
    }

    ResourcePost.prototype.toString         = function ()
    {
        return "[res-post -> " + this.request + " <- " + this.response + "]";
    };
    Parser.prototype.parse_respost          = function ()
    {
        var request, response;
        request = this.parse_resrequest();
        if (!request)
        {
            return false;
        }

        this.parse_s();
        response = required(this.parse_resresponse(), "expected res-response");
        return new ResourcePost(request, response);
    };
    ResourcePost.prototype.compare_request  = function (request, variants)
    {
        return this.request.compare(request, variants);
    };
    ResourcePost.prototype.compare_response = function (response, variants)
    {
        return this.response.compare(response, variants);
    };

    // res-request     = "->" s value
    Parser.prototype.parse_resrequest = function ()
    {
        if (!this.match("->"))
        {
            return false;
        }
        this.parse_s();
        return required(this.parse_value(), "expected value");
    };

    // res-response    = "<-" s value
    Parser.prototype.parse_resresponse = function ()
    {
        if (!this.match("<-"))
        {
            return false;
        }
        this.parse_s();
        return required(this.parse_value(), "expected value");
    };

    // res-transaction = res-get / res-getput / res-getputdel / res-post
    Parser.prototype.parse_restransaction = function ()
    {
        var t;
        t = this.parse_resget();
        if (t)
        {
            return t;
        }
        t = this.parse_resgetput();
        if (t)
        {
            return t;
        }
        t = this.parse_resgetputdel();
        if (t)
        {
            return t;
        }
        t = this.parse_respost();
        if (t)
        {
            return t;
        }
        return false;
    };

    // resource-def    = res-name s res-transaction
    function ResourceDef(name, transaction)
    {
        this.name        = name;
        this.transaction = transaction;
    }

    ResourceDef.prototype.toString         = function ()
    {
        return "[resource-def " + this.name + " " + this.transaction + "]";
    };
    Parser.prototype.parse_resourcedef     = function ()
    {
        var name, transaction;
        name = this.parse_resname();
        if (!name)
        {
            return false;
        }

        this.parse_s();
        transaction = required(this.parse_restransaction(), "expected transaction");
        return new ResourceDef(name, transaction);
    };
    ResourceDef.prototype.compare_request  = function (request, variants)
    {
        return this.transaction.compare_request(request, variants);
    };
    ResourceDef.prototype.compare_response = function (response, variants)
    {
        return this.transaction.compare_response(response, variants);
    };

    // definitions     = *( s / variant-def / resource-def )
    function Suite()
    {
        this.variantdefs  = [];
        this.resourcedefs = {};
    }

    Parser.prototype.parse_definitions = function ()
    {
        /*jslint continue: true*/
        var defs = new Suite(),
            d;

        while (!this.eof())
        {
            if (this.parse_s())
            {
                continue;
            }

            d = this.parse_variantdef();
            if (d)
            {
                defs.variantdefs.push(d);
                continue;
            }

            d = this.parse_resourcedef();
            if (d)
            {
                defs.resourcedefs[d.name] = d;
                continue;
            }

            if (!d)
            {
                break;
            }
        }

        required(this.eof(), "expected end of input");

        return defs;
    };
    Suite.prototype.get_rd             = function (name)
    {
        return required(this.resourcedefs[name], "No matching resource definition found");
    };
    Suite.prototype.valid_request      = function (name, value)
    {
        return this.get_rd(name).compare_request(value, this.variantdefs) > INCOMPATIBLE;
    };
    Suite.prototype.valid_response     = function (name, value)
    {
        return this.get_rd(name).compare_response(value, this.variantdefs) > INCOMPATIBLE;
    };
    Suite.prototype.match_request      = function (name, value)
    {
        return this.get_rd(name).compare_request(value, this.variantdefs) > ADDITIONAL;
    };
    Suite.prototype.match_response     = function (name, value)
    {
        return this.get_rd(name).compare_response(value, this.variantdefs) > ADDITIONAL;
    };

    ////////////////////////////////////////////////////////////
    //
    // Functions
    //
    ////////////////////////////////////////////////////////////

    // Expose to the world beyond the closure

    if (typeof LLIDL.parse_suite !== 'function')
    {
        LLIDL.parse_suite = function (llidl)
        {
            var parser = new Parser(llidl),
                suite  = parser.parse_definitions();
            if (!suite)
            {
                throw new LLIDLException("expected suite");
            }
            if (!parser.eof())
            {
                throw new LLIDLException("expected end of input");
            }
            return suite;
        };
    }

    if (typeof LLIDL.parse_value !== 'function')
    {
        LLIDL.parse_value = function (llidl)
        {
            var parser = new Parser(llidl),
                value  = parser.parse_value();
            if (!value)
            {
                throw new LLIDLException("expected value");
            }
            if (!parser.eof())
            {
                throw new LLIDLException("expected end of input");
            }
            return value;
        };
    }

    if (typeof LLIDL.parse_variantdef !== 'function')
    {
        LLIDL.parse_variantdef = function (llidl)
        {
            var parser = new Parser(llidl),
                vardef = parser.parse_variantdef();
            if (!vardef)
            {
                throw new LLIDLException("expected variant definition");
            }
            if (!parser.eof())
            {
                throw new LLIDLException("expected end of input");
            }
            return vardef;
        };
    }

    return {
        URI:            URI,
        UUID:           UUID,
        Binary:         Binary,
        LLSD:           LLSD,
        LLIDL:          LLIDL,
        LLIDLException: LLIDLException
    }
}());
