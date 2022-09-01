/* @allex/crc32 v1.0.4 | MIT licensed | allex <allex.wxn@gmail.com> (http://iallex.com/) */
var crc32b = (function () {
    var table = new Uint32Array(256);
    for (var i = 256; i--;) {
        var c = i;
        for (var k = 8; k--;) {
            c = c & 1 ? 0xEDB88320 ^ c >>> 1 : c >>> 1;
        }
        table[i] = c;
    }
    return function (data) {
        var crc = -1;
        if (typeof data === 'string') {
            data = (function (d) {
                var l = d.length, data = new Array(l);
                for (var i = -1; ++i < l;)
                    data[i] = d.charCodeAt(i);
                return data;
            })(data);
        }
        for (var i = 0, l = data.length; i < l; i++) {
            crc = crc >>> 8 ^ table[(crc & 0xFF ^ data[i])];
        }
        return (crc ^ -1) >>> 0;
    };
})();
var hex = function (what) {
    if (what < 0)
        what = 0xFFFFFFFF + what + 1;
    return ('0000000' + what.toString(16)).slice(-8);
};
var crc32 = function (data, encoding) {
    var crc = crc32b(data);
    if (encoding) {
        return hex(crc);
    }
    return crc;
};

export { crc32, hex };
