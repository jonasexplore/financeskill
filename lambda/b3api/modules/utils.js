const https = require('https');

function makeRequest(path, resolve, reject) {

    const options = {
        hostname: 'b3api.vercel.app',
        path,
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    };

    const req = https.request(options, res => {

        if (res.statusCode >= 400)
            return reject(new Error(`HTTP ${res.statusCode} error!`));

        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve(JSON.parse(body)));

    });

    req.on('error', error => reject(new Error(error)));
    req.end();

}

module.exports = {
    makeRequest
}
