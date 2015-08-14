/**
 * Created by tylery on 8/14/2015.
 */
var express = require('express');
var app = express();

app.get('/', function (req, res) {
    res.send('Voice Over App');
});

var server = app.listen(3000, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Example app listening at http://localhost:3000', host, port);
});
